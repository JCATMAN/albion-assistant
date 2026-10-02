# Respaldo por API

## Qué es

La misma subida de los clientes del Data Project, leída en reposo. Entra cuando NATS no está alimentando una celda. No se llama desde una petición de Discord. Discord ni siquiera habla con este proceso.

Endpoint:

```text
GET {ALBION_API_BASE}/api/v2/stats/prices/{items}.json?locations=Caerleon,Martlock&qualities=1
```

Pedir `Accept-Encoding: gzip`. El cuerpo útil es un array. Cada elemento trae `item_id`, `city`, `quality`, mínimos y máximos de venta y compra, y sus fechas. No trae cantidades.

Un precio `0` o una fecha `0001-01-01T00:00:00` significa «nadie lo ha visto». Esa cifra no se guarda.

Tope público: 180 peticiones por minuto y 300 cada 5 minutos. La URL no puede pasar de 4096 caracteres. Este proceso se queda en `API_RATE_PER_MIN` (default 150).

## Cómo hacerlo

`internal/albionapi.Current` arma la URL, decodifica y traduce cada fila a `cell.Update` con `Source: "api"`. Varios ítems van separados por coma en un solo path, mientras la URL quepa.

Dos disparadores, los dos dentro de `app`, en un ticker (por ejemplo cada minuto):

1. **Arranque.** Si `WATCH_ITEMS` tiene ítems, se piden una vez para las ocho ciudades y las calidades 1–5. Sirve para no esperar a que alguien abra el mercado.
2. **Barrido.** `store.Stale(now-STALE_AFTER, N)` y también cuando `conn.Alive()` es false. Se reagrupan esas celdas en la menor cantidad de URLs posible.

Antes de pisar, se compara `updated_at`. Si NATS escribió la celda después de armar la petición, la respuesta del API se tira. NATS gana cuando es más nuevo.

El ticker no corre en el goroutine que aplica órdenes. Publica trabajos a ese mismo goroutine, o espera su cola, para no escribir la misma celda en paralelo.

## Resultado esperado

Con NATS caído y una celda de `T4_BAG` en Caerleon más vieja que `STALE_AFTER`, el siguiente tick la refresca, `source` pasa a `api` y `sell_min` / `buy_max` salen de la fila. Los ceros del JSON no crean celdas nuevas.

Con NATS vivo y la celda recién escrita, el tick no la incluye. Una lista de vigilancia vacía no hace la pasada de arranque.

## Pruebas

`httptest.Server` que devuelve un JSON fijo. Nadie llama a `west.albion-online-data.com` en `go test`.

| Caso | Esperado |
|---|---|
| fila con sell 4978 y buy 3000 | dos lados, source api, sin amounts |
| sell 0 y fecha año 1 | ese lado no va en el update |
| dos ítems | una sola request si caben en la URL |
| más ítems que 4096 caracteres | se parte en dos requests |
| el servidor responde 429 | error, el loop sigue, no se escribe |
| update API con `updated_at` anterior al de Redis | el store no cambia la celda |

El rate limit se prueba con un reloj falso: 151 llamadas en el mismo minuto, la última no sale hasta el minuto siguiente.
