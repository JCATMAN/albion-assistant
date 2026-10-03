# Albion Assistant

Precios de mercado de **Albion Online, solo Américas (West)**, consultables por HTTP y por un comando de Discord. Un proceso en Go escucha el mercado en vivo y escribe Redis. Un API en NestJS lee esas celdas, resuelve nombres en español o inglés y responde a Discord.

No hace falta acertar el nombre del juego. `bolsa t4.1` encuentra `T4_BAG@1` («Bolsa del iniciado») y devuelve el mejor precio listado por ciudad, calidad y encantamiento, con frescura e icono.

## Cómo se mueve el dato

```mermaid
flowchart LR
  subgraph albion [Fuentes]
    NATS["NATS Américas<br/>marketorders.deduped"]
    AODP["API West<br/>west.albion-online-data.com"]
    ITEMS["items.json"]
    RENDER["render.albiononline.com"]
  end

  subgraph app [Este repositorio]
    WRITER["writer · Go"]
    API["api · NestJS"]
  end

  REDIS[("Redis 8")]
  USER["Discord o HTTP"]

  NATS --> WRITER
  AODP --> WRITER
  WRITER --> REDIS
  REDIS --> API
  ITEMS --> API
  USER --> API
  API --> RENDER
```

`writer` es el único que abre NATS y el API de Albion, y el único que escribe precios. `api` no habla con Albion: lee Redis y el catálogo. Discord entra por `POST /discord/interactions` en el mismo API. No hay un bot con gateway.

```mermaid
sequenceDiagram
  participant N as NATS Américas
  participant W as writer
  participant R as Redis
  participant A as api
  participant D as Discord

  N->>W: orden deduplicada
  W->>R: celda west:item:ciudad:q:e
  D->>A: autocompletado
  A-->>D: hasta 25 nombres
  D->>A: comando price
  A->>R: HGETALL
  A-->>D: embed con precios e icono
```

Si NATS deja de alimentar una celda, el writer la rellena desde el API West cuando pasa de `STALE_AFTER`. Una respuesta del API no pisa una celda que NATS acaba de actualizar. Los ceros y las fechas del año 1 significan «nadie lo ha visto» y no se guardan.

## Qué guarda Redis

Una hash por ítem, ciudad, calidad y encantamiento. El prefijo `west:` separa estas claves del resto de la instancia.

```text
west:T4_BAG:Caerleon:q1:e1
```

| Campo | Significado |
|---|---|
| `sell_min` / `buy_max` | Mejor venta y mejor compra, en plata |
| `sell_amount` / `buy_amount` | Cantidad de la orden que fijó ese precio. El API de Albion no trae cantidad |
| `sell_avg` / `buy_avg` | Media móvil del mejor precio listado. Solo se mueve cuando ese mejor precio cambia |
| `updated_at` | Unix segundos. Esto decide si la celda está fresca |
| `source` | `nats` o `api` |

`Black Market` y `Fort Sterling` llevan el espacio en la clave. El encantamiento va en `e`, no en el nombre: `T4_BAG` y `T4_BAG@1` comparten base.

Ciudades de esta versión: Thetford, Lymhurst, Bridgewatch, Black Market, Caerleon, Martlock, Fort Sterling y Brecilien. El resto de ubicaciones se descarta.

El icono no se guarda. Se arma al responder:

```text
https://render.albiononline.com/v1/item/T4_BAG@1.png?quality=2&size=100
```

## Servicios

| Pieza | Stack | Rol |
|---|---|---|
| `nats/` | Go 1.23 | Writer. Suscripción, celdas, media móvil y respaldo |
| `api/` | NestJS 11 | Lectura, catálogo, sugerencias, precios y Discord |
| Redis 8 | Ya existente | Libro de precios. No se levanta en este Compose |

Límites del Compose: writer 64 MB y 0.1 CPU, API 192 MB y 0.2 CPU. Una sola réplica del writer. Dos réplicas duplicarían la media móvil. El API se puede escalar porque no escribe.

El detalle de cada feature está en [nats/docs](nats/docs/README.md) y [api/docs](api/docs/README.md).

## Variables

El `.env` vive en la raíz, al lado de `docker-compose.yml`, o en el Environment del proyecto en Dokploy. Ningún proceso lee un archivo dentro de `nats/` o `api/`. Compose sustituye `${...}` y entrega el valor al contenedor.

Obligatorias:

| Variable | Quién | Ejemplo |
|---|---|---|
| `NATS_URL` | writer | `nats://public:thenewalbiondata@nats.albion-online-data.com:4222` |
| `ALBION_API_BASE` | writer | `https://west.albion-online-data.com` |
| `REDIS_URL` | writer y api | `redis://default:clave@host:6379` |
| `ITEMS_URL` | api | `https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json` |
| `DISCORD_PUBLIC_KEY` | api | public key hex de la aplicación |

Con default en el Compose, no hace falta definirlas:

| Variable | Default | Efecto |
|---|---|---|
| `NATS_SUBJECT` | `marketorders.deduped` | Topic. No usar `ingest` ni `bulk` |
| `CELL_TTL` | `2h` | Borrado de basura en Redis. No es la frescura que ve el usuario |
| `STALE_AFTER` | `30m` | A partir de aquí el writer pide el API |
| `FRESH_WITHIN` | `30m` | Por debajo de esto el API marca la celda `fresh` |
| `AVG_ALPHA` | `0.2` | Peso de la media móvil. Rechaza `0` y valores mayores que `1` |
| `API_RATE_PER_MIN` | `150` | Tope propio. Más de `180` no arranca |
| `CATALOG_REFRESH` | `1h` | Recarga de `items.json` |
| `WATCH_ITEMS` | vacío | Lista `T4_BAG,T5_BAG` para rellenar al arrancar |
| `PORT` | `3000` | Puerto del API dentro del contenedor |

`DISCORD_TOKEN` y `DISCORD_APP_ID` no entran al contenedor. Solo los usa `npm run register:commands`, que se corre a mano.

En Dokploy, `REDIS_URL` apunta al host externo de la base (`redis://default:clave@ip:6379`). El writer no está en `dokploy-network`, así que el hostname interno del contenedor de Redis no le resuelve.

## Despliegue

Dokploy toma este repositorio y el `docker-compose.yml` de la raíz. Ese archivo levanta `writer` y `api`. Redis ya tiene que existir.

```mermaid
flowchart TB
  subgraph dokploy [Dokploy]
    ENV["Environment del proyecto"]
    COMPOSE["docker-compose.yml"]
    ENV --> COMPOSE
    COMPOSE --> WRITER["writer"]
    COMPOSE --> API["api :3000"]
  end

  REDIS["Redis externo :6379"]
  PROXY["Proxy HTTPS"]
  DC["Discord"]

  WRITER --> REDIS
  API --> REDIS
  PROXY --> API
  DC --> PROXY
```

1. Crea la aplicación Compose apuntando a este repo.
2. Carga las variables obligatorias en Environment. No las pongas en el repositorio.
3. La red `dokploy-network` del Compose es externa y ya existe en un servidor Dokploy.
4. Deploy. `GET /health` responde `{"status":"ok"}` sin tocar Redis.
5. Publica el API por HTTPS. Discord no entrega interactions por HTTP plano. La URL del endpoint es `https://<host>/discord/interactions`.

`GET /items/suggest` funciona en cuanto cargó el catálogo, aunque Redis todavía esté vacío. `GET /prices` falla con un error claro si Redis no conecta. Si la primera descarga de `items.json` falla, el API no arranca a medias.

## Discord

Crea una aplicación en el portal de Discord. En Interactions Endpoint URL pon la URL pública de arriba. La public key va en `DISCORD_PUBLIC_KEY`.

Registra el comando una vez, fuera del contenedor:

```bash
cd api
DISCORD_TOKEN=... DISCORD_APP_ID=... npm run register:commands
```

El comando `price` muestra la tabla por ciudad. En español se ve como Precio. Las opciones son objeto, ciudad, calidad y encantamiento. Si no eliges calidad ni encantamiento, aparecen botones para cambiarlos sin un mensaje nuevo.

El comando `arbitrage` busca la ruta: comprar en la ciudad más conveniente y vender al instante en otra. En español se ve como Arbitraje. No pide ciudad. El detalle está en [api/docs/arbitraje.md](api/docs/arbitraje.md).

El autocompletado admite 25 opciones y no lleva imagen. El icono va en el embed. Hay que contestar en menos de 3 segundos: el bot avisa a Discord al momento y edita el mensaje cuando el precio está listo.

Firma inválida: `401`. El handler no corre y no consulta precios.

## HTTP

```text
GET /health
GET /items/suggest?q=bolsa%20t4.1&locale=es
GET /prices?item=T4_BAG@1&cities=Caerleon&qualities=1&locale=es
POST /discord/interactions
```

`q` vacío o `item` vacío responden `400`. Una ciudad fuera de las ocho también. Una celda sin hash vuelve `status: "missing"` con precios en `null`, no en cero. `fresh` y `stale` salen de `updated_at` comparado con `FRESH_WITHIN`.

`locale` es `es` o `en`. El default es español.

## Desarrollo

Requisitos locales: Go 1.23 o superior, Node 22.

```bash
cd nats && go test ./...
cd api && npm ci && npm test && npm run build
```

Los tests no abren NATS, Redis real ni Discord. Go usa `miniredis` y `httptest`. Nest usa fakes y Supertest.

Para correr los procesos a mano, exporta las mismas variables y lanza `go run ./cmd/writer` dentro de `nats/` y `npm run start` dentro de `api/`.

## Fuera de esta versión

Europa, Asia, historial de ventas cerradas, precio del oro, guardar cada id de orden y devolver el libro completo de un mercado. El promedio que sí existe es el de los mejores precios listados, en la misma celda.
