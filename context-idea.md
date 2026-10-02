# Albion Assistant

Contexto de diseño para implementar el proyecto. Región inicial: **Américas (West)**. El documento fija qué se construye, con qué stack, cómo fluye el dato y cómo se despliega. No es el detalle de cada endpoint.

## Objetivo

Un bot de Discord consulta precios de mercado de Albion Online con filtros (ítem, tier, ciudad, calidad, encantamiento) y nombres en español o inglés. El usuario no tiene que acertar el nombre exacto: el autocompletado le propone opciones. La respuesta muestra el precio observado, la cantidad, la frescura y el icono del ítem.

Los procesos propios escriben y leen el Redis 8 que ya corre en el VPS. No se levanta otro. Solo uno escribe precios.

| Pieza | Rol | Stack |
|---|---|---|
| `writer` | Escucha NATS, rellena huecos con el API y escribe Redis | Go |
| `reader` | Resuelve nombres, filtros y lecturas. No habla con Albion | NestJS |
| `bot` | Slash commands, autocompletado y embeds | Node + discord.js |
| Redis del VPS | Libro de precios vivo, instancia ya instalada | Redis 8 |

Discord y cualquier otro cliente hablan solo con `reader`. `reader` habla solo con Redis y con el catálogo en memoria. `writer` es el único que abre NATS y el API de Albion.

## Arquitectura

```mermaid
flowchart LR
  subgraph albion [Fuentes externas]
    NATS["NATS Américas<br/>marketorders.deduped"]
    API["API REST West<br/>/api/v2/stats/prices"]
    ITEMS["items.json<br/>ao-bin-dumps"]
    RENDER["render.albiononline.com<br/>iconos PNG"]
  end

  subgraph host [Docker Compose en el VPS]
    WRITER["writer · Go"]
    READER["reader · NestJS"]
    BOT["bot · discord.js"]
  end

  REDIS[("Redis 8<br/>ya instalado en el VPS")]

  USER["Usuario de Discord"]

  NATS --> WRITER
  API --> WRITER
  ITEMS --> WRITER
  ITEMS --> READER
  WRITER --> REDIS
  READER --> REDIS
  BOT --> READER
  USER --> BOT
  RENDER -.-> USER
```

El icono no pasa por nuestros contenedores. `reader` arma la URL y Discord la descarga al pintar el embed.

```mermaid
flowchart TB
  subgraph write [Escritura · un solo proceso]
    INGEST["Mensaje NATS<br/>orden offer o request"]
    STALE{"¿Celda vieja<br/>o NATS caído?"}
    BACKFILL["Lote al API<br/>bajo el rate limit"]
    CELL["HSET de la celda<br/>+ updated_at + source"]
    INGEST --> CELL
    STALE -->|sí| BACKFILL --> CELL
  end

  subgraph read [Lectura]
    CMD["Slash command"]
    AUTO["Autocompletado<br/>catálogo en memoria"]
    Q["GET /prices<br/>claves armadas"]
    PIPE["Pipeline Redis"]
    EMBED["Embed con precio,<br/>cantidad, frescura e icono"]
    CMD --> AUTO
    CMD --> Q --> PIPE --> EMBED
  end

  CELL --> PIPE
```

## Fuentes y qué se espera de cada una

### NATS

Canal en vivo. El cliente del [Albion Online Data Project](https://www.albion-online-data.com/) sube las órdenes que un jugador abre en el mercado. Nosotros nos suscribimos; no publicamos.

- Host Américas: `nats://public:thenewalbiondata@nats.albion-online-data.com:4222`
- Topic útil: `marketorders.deduped`. Una orden que no se repitió en la ventana de deduplicación (unos 10 minutos en el servidor actual).
- No usar `*.ingest`: trae duplicados y la plata todavía en unidades internas del juego.
- Quien se conecta tarde no recibe lo anterior. NATS no guarda el libro.
- `offer` es venta, `request` es compra.
- En `deduped`, `UnitPriceSilver` ya está en plata (el proyecto dividió entre 10.000).
- Campos que importan: `Id`, `ItemTypeId`, `LocationId`, `QualityLevel`, `EnchantmentLevel`, `UnitPriceSilver`, `Amount`, `AuctionType`, `Expires`.

`writer` traduce `LocationId` al nombre de ciudad y actualiza solo la celda de ese ítem, ciudad, calidad y encantamiento. Si llega una venta más barata, baja `sell_min`. Si llega una compra más cara, sube `buy_max`. La cantidad guardada es la de ese mejor precio, no la suma de todo el libro.

### API REST

Misma información, resumida y más vieja. Sirve cuando NATS no trae nada, no como consulta de cada usuario.

- Base: `https://west.albion-online-data.com`
- Precios: `GET /api/v2/stats/prices/{items}.json?locations=...&qualities=...`
- Devuelve mínimo y máximo de venta y de compra del bloque de 5 minutos más reciente, dentro de las últimas 24 horas. No trae cantidades ni el libro entero.
- Precio `0` o fecha `0001-01-01` significa «nadie lo ha visto». No se guarda.
- Límite: 180 peticiones por minuto y 300 cada 5 minutos. URL máxima de 4096 caracteres. Pedir gzip.
- Historial (`/history`) y oro (`/gold`) quedan fuera de la primera versión.

`writer` llama al API en dos momentos: al arrancar, para los ítems de una lista de vigilancia, y después, en un barrido lento, solo para celdas cuyo `updated_at` superó el umbral (unos 20–30 minutos) o cuando la conexión NATS está caída. NATS pisa esas celdas en cuanto vuelve un mensaje más nuevo.

### Catálogo de ítems

`https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json`

No depende de la región. Trae `UniqueName`, `Index` y `LocalizedNames` (`ES-ES`, `EN-US` y otros). No trae precios ni imágenes.

Ejemplo: `T4_BAG` es «Bolsa del iniciado» y «Adept's Bag». `T4_BAG@1` se llama igual; el encantamiento no está en el texto.

`writer` y `reader` lo cargan al arrancar y lo refrescan cada tanto. Redis no guarda nombres.

### Iconos

Servicio de render del juego, aparte del Data Project: [API:Render service](https://wiki.albiononline.com/wiki/API:Render_service).

```text
https://render.albiononline.com/v1/item/T4_BAG@1.png?quality=2&size=100
```

`@1` es el encantamiento. `quality` va de 1 a 5 y cambia el marco. `reader` devuelve esa URL. Discord la usa como miniatura.

## Modelo en Redis

Una celda por combinación observada. No se precargan las combinaciones vacías.

```text
west:{uniqueName}:{ciudad}:q{calidad}:e{encantamiento}
```

Ejemplo: `west:T4_BAG:Caerleon:q1:e0`

Hash:

| Campo | Uso |
|---|---|
| `sell_min` | Mejor precio de venta listado ahora (`offer`) |
| `sell_amount` | Cantidad en ese precio |
| `sell_avg` | Media móvil de los `sell_min` que fueron cambiando |
| `buy_max` | Mejor precio de compra listado ahora (`request`) |
| `buy_amount` | Cantidad en ese precio |
| `buy_avg` | Media móvil de los `buy_max` que fueron cambiando |
| `updated_at` | Cuándo se escribió, en epoch |
| `source` | `nats` o `api` |

TTL de 1–2 horas solo para borrar basura. Lo que decide si el precio se muestra es `updated_at` y la cantidad. Una celda ausente, vieja o con cantidad 0 se responde como no disponible, nunca como precio cero.

La clave es neutra. Español e inglés se resuelven antes de leer Redis y se eligen al responder, según el `locale` pedido.

Dimensiones cerradas, por eso la lectura no necesita un índice invertido:

- Ciudades de mercado: del orden de diez.
- Calidad: 1–5.
- Encantamiento: 0–4.
- Tier: va en el `UniqueName` (`T4`, `T5`, …).

`reader` arma la lista de claves con el catálogo y las pide en un pipeline. Un ítem en todas las ciudades y calidades son unos pocos cientos de `HGET`, por debajo de un milisegundo en la red interna. El corte «todo lo que hay en una ciudad», sin ítem, no se ofrece en la primera versión.

Cien mil celdas observadas ocupan unas pocas decenas de megabytes. Llenar la matriz teórica (ítem × ciudad × calidad × encantamiento) se acerca a un gigabyte y no aporta.

## Último precio, historial y promedio

La celda guarda el **mejor precio listado ahora**, y lo pisa cuando llega otro mejor. No guarda la última venta ni una serie de precios. `sell_min` es la oferta de venta más barata vista para esa ciudad, calidad y encantamiento. `buy_max` es la orden de compra más cara. Si alguien pone la bolsa a 5.000 y más tarde otra a 4.800, en Redis queda 4.800. El 5.000 desaparece.

Eso no es el historial de ventas del Data Project. Ese historial (`markethistories.deduped` y `/api/v2/stats/history`) son ventas ya cerradas: cuántas unidades se vendieron y a qué precio medio, en bloques de 1 hora, 6 horas o 1 día. Solo existe del lado venta. No dice qué hay puesto ahora. Queda fuera de esta versión: es otra suscripción, otro forma de dato y no mejora el «¿a cómo está ahora?».

Un promedio de lo que vamos viendo sí cabe en la misma celda, sin otro servicio ni otra estructura.

| Forma | Qué promedia | RAM extra en 100.000 celdas | Cuándo usarlo |
|---|---|---|---|
| Media móvil en la misma hash (`sell_avg`, `buy_avg`) | El mejor precio de cada lado, solo cuando ese mejor precio cambia | Unos pocos MB | «Últimamente se lista alrededor de este número» |
| 24 cubetas por hora, en la misma hash | Lo mismo, con ventana de un día | Del orden de 50–100 MB en la instancia del VPS | Si más adelante hace falta la curva del día |
| Historial de ventas del proyecto | Ventas cerradas, solo venta, sin compras | Otra ingesta | Fuera de esta versión |

La media móvil se actualiza con un factor fijo, en el mismo `HSET`: `avg = avg + alpha * (precio - avg)`. No se actualiza en cada mensaje. La misma orden puede reaparecer cada ~10 minutos; contarla otra vez inflaría ese precio. Solo entra al promedio cuando `sell_min` o `buy_max` cambian de verdad.

Ese número es el promedio de los mejores precios listados, no el promedio de lo que la gente pagó. Para el bot alcanza: al lado del precio actual se puede mostrar «se ha venido listando cerca de X». El contrato de `/prices` puede agregar `sellAvg` y `buyAvg` sin cambiar claves ni servicios.

## Búsqueda

No se traduce español → inglés. Los dos nombres apuntan al mismo `UniqueName`.

```mermaid
flowchart TD
  RAW["Texto: bolsa t4.1"]
  PARSE["Parser"]
  NAME["Texto restante: bolsa"]
  TIER["Tier 4"]
  ENCH["Encantamiento 1"]
  IDX["Índice en memoria<br/>nombre normalizado → UniqueName"]
  HITS["Candidatos de tier 4<br/>cuyo nombre contiene bolsa"]
  ONE{"¿Un solo ítem base?"}
  PICK["Se usa T4_BAG@1"]
  MENU["Hasta 25 opciones<br/>para que el usuario elija"]

  RAW --> PARSE
  PARSE --> NAME --> IDX --> HITS
  PARSE --> TIER --> HITS
  PARSE --> ENCH --> HITS
  HITS --> ONE
  ONE -->|sí| PICK
  ONE -->|no| MENU
```

El parser saca, si vienen en la frase, `t4.1`, `t4`, `4.1`, `T4@1`, calidad (`excelente`, `q4`) y ciudad (`caerleon`). El resto se compara en minúsculas y sin acentos, en `ES-ES` y `EN-US`.

«bolsa» sola toca más de cien ítems. «bolsa» más tier 4 deja un puñado (la bolsa normal, la de visión y alguna no comerciable). Si queda más de uno, se listan y no se adivina.

El índice vive en el proceso de `reader` y en el del `bot` solo si el autocompletado se resuelve ahí. Preferible: el bot reenvía el texto a `reader` (`GET /items/suggest?q=bolsa+t4`) y `reader` responde los candidatos. Un solo sitio conoce el catálogo de búsqueda.

## Discord

Comando slash, por ejemplo `/precio`.

| Opción | Tipo | Por qué |
|---|---|---|
| `item` | string con autocomplete | El catálogo es enorme |
| `ciudad` | choices fijos, opcional | Hay pocas |
| `calidad` | choices fijos, opcional | 1–5 |
| `encantamiento` | choices fijos, opcional | 0–4 |

El autocompletado de Discord devuelve como máximo 25 opciones, cada una con `name` y `value` (máximo 100 caracteres), y hay que responder en menos de 3 segundos. No admite imagen. Documentación: [Application Commands](https://docs.discord.com/developers/interactions/application-commands).

Ejemplo de opción: nombre `Bolsa del iniciado · T4.1`, valor `T4_BAG@1`.

Esa respuesta sale del catálogo en memoria, no de Redis ni del API. Al confirmar el comando, el bot llama a `reader` con el `UniqueName` ya elegido y pinta el embed con precios por ciudad y la miniatura del render.

Quien escriba libre y pulse enter sin elegir una opción no queda aceptado a ciegas. Si no hay un único match, el bot pide que elija de la lista.

```mermaid
sequenceDiagram
  actor U as Usuario
  participant D as Discord
  participant B as bot
  participant R as reader
  participant S as Redis

  U->>D: escribe "bolsa t4"
  D->>B: interacción autocomplete
  B->>R: GET /items/suggest?q=bolsa t4
  R-->>B: hasta 25 UniqueName con nombre ES
  B-->>D: choices name + value
  U->>D: elige Bolsa del iniciado · T4.1
  D->>B: comando con T4_BAG@1
  B->>R: GET /prices?item=T4_BAG@1
  R->>S: pipeline de celdas
  S-->>R: hashes
  R-->>B: precios, frescura, URL del icono
  B-->>D: embed
  D-->>U: mensaje con miniatura
```

## Contratos internos

`GET /items/suggest?q=&locale=es`

Respuesta: hasta 25 `{ uniqueName, name, tier, enchantment }`. `locale` solo cambia el nombre visible.

`GET /prices?item=T4_BAG@1&cities=Caerleon,Martlock&qualities=1&locale=es`

Respuesta por celda: ciudad, calidad, encantamiento, `sellMin`, `sellAmount`, `buyMax`, `buyAmount`, `updatedAt`, `source`, `status` (`fresh`, `stale`, `missing`) y `iconUrl`.

No hay un tercer formato. El bot no interpreta Redis.

## Qué le faltaba al esquema inicial

- NATS y el API no son dos mercados. Son la misma subida, vista al momento y resumida después. El API no es «más verdadero»; es el respaldo cuando el vivo no llega.
- Llamar al API en cada petición de Discord gasta el cupo de 180/minuto justo cuando Redis está vacío, y mete latencia. El respaldo ocurre dentro de `writer`, en segundo plano.
- Dos escritores sobre las mismas claves se pisan. Go escribe. Nest lee.
- Un TTL corto como definición de verdad borra órdenes que siguen vigentes y refresca precios fantasma. La verdad de cara al usuario es `updated_at` más cantidad.
- Guardar «el precio del producto» mezcla ciudades, calidades y encantamientos. La unidad es la celda.
- Traducir la búsqueda al inglés pierde empates y acentos. El identificador del juego es el puente.
- El nombre en español no contiene `T4` ni `.1`. Hay que partir la jerga antes de buscar en el catálogo.
- El autocompletado no muestra el PNG. El icono es una URL del render en el mensaje final.
- El bot no es un servicio de datos. Reiniciarlo no puede vaciar el libro, y reiniciar `writer` no puede tirar Discord.
- Precio 0 del API no es un ítem gratis.

## Despliegue

El VPS ya tiene Redis 8. Compose solo levanta los procesos propios y les pasa `REDIS_URL`. No hay servicio `redis` en el compose, ni volumen, ni límite de memoria que administrar ahí.

Las claves de este proyecto empiezan por `west:`. Comparten la instancia sin mezclarse con lo que ya esté guardado. Nadie ejecuta `FLUSHDB` ni `FLUSHALL`.

```mermaid
flowchart TB
  subgraph compose [docker compose en el VPS]
    direction TB
    W["writer<br/>límite 64 MB · 0.1 CPU"]
    R["reader<br/>límite 192 MB · 0.2 CPU"]
    B["bot<br/>límite 128 MB · 0.1 CPU"]
    B --> R
  end

  S[("Redis 8 del VPS")]
  W --> S
  R --> S
  NATS["NATS :4222"] --> W
  API["west.albion-online-data.com"] --> W
  GH["GitHub items.json"] --> W
  GH --> R
  DC["Discord gateway"] <--> B
```

Si Redis escucha solo en `127.0.0.1` del VPS, desde un contenedor esa dirección es el propio contenedor. La URL tiene que alcanzar al host, por ejemplo `host.docker.internal` con `extra_hosts: ["host.docker.internal:host-gateway"]`.

Límites de los procesos que sí construimos:

| Servicio | Imagen | RAM | CPU | Notas |
|---|---|---|---|---|
| `writer` | binario Go en `scratch` o `distroless` | 64 MB | 0.1 | Un réplica. Dos réplicas duplicarían escrituras |
| `reader` | `node:*-alpine` | 192 MB | 0.2 | El catálogo pesa más que el proceso. Se puede escalar a más réplicas porque no escribe |
| `bot` | `node:*-alpine` | 128 MB | 0.1 | Una réplica. El gateway de Discord no quiere dos sesiones con el mismo token |

Variables que cada servicio necesita:

| Variable | Quién | Valor esperado |
|---|---|---|
| `NATS_URL` | writer | URL pública de Américas, puerto 4222 |
| `ALBION_API_BASE` | writer | `https://west.albion-online-data.com` |
| `ITEMS_URL` | writer, reader | raw de `formatted/items.json` |
| `REDIS_URL` | writer, reader | URL con credenciales del Redis del VPS. No va al repositorio |
| `STALE_AFTER` | writer | 20–30 minutos |
| `CELL_TTL` | writer | 1–2 horas |
| `READER_URL` | bot | `http://reader:3000` |
| `DISCORD_TOKEN` | bot | secreto, no va al repositorio |
| `DISCORD_APP_ID` | bot | id de la aplicación |

Salud: `writer` sigue vivo aunque NATS se caiga, y pasa a modo API. `reader` responde aunque Redis no tenga una celda (`missing`), y falla el healthcheck solo si Redis no conecta. El bot no arranca sin token ni sin `reader`.

Orden de arranque: `writer` y `reader` en paralelo contra el Redis que ya está corriendo, luego el bot. `reader` puede sugerir ítems en cuanto cargó el JSON, aunque el libro todavía esté vacío. Si Redis se reinicia y pierde las celdas, `writer` las reconstruye con NATS y el API.

## Fuera de esta versión

Historial de ventas cerradas del Data Project, precio del oro, otras regiones, el corte «todo un mercado», guardar cada `Id` de orden, y un índice Redis para búsquedas abiertas. El promedio de los mejores precios listados no entra en esta lista: vive en la misma celda. El resto se agrega encima sin cambiar el corte de servicios.
