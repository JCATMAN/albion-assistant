# Redis

## Qué es

La instancia Redis 8 del VPS guarda una hash por celda. Este proceso no la instala: se conecta con `REDIS_URL`. `api/` lee esos campos y no escribe. Las claves van prefijadas con `west:` para no chocar con el resto de esa instancia.

Clave: `west:T4_BAG:Caerleon:q1:e0`

| Campo | Tipo | Quién lo llena |
|---|---|---|
| `sell_min` | entero, plata | NATS o API |
| `sell_amount` | entero | solo NATS. El API no trae cantidad |
| `sell_avg` | entero | solo cuando el mínimo cambia |
| `buy_max` | entero | NATS o API |
| `buy_amount` | entero | solo NATS |
| `buy_avg` | entero | solo cuando el máximo cambia |
| `updated_at` | unix segundos | ambos |
| `source` | `nats` o `api` | ambos |

TTL de la clave: `CELL_TTL` (default 2 horas), renovado en cada escritura. El TTL borra basura. No es la frescura que ve el usuario. Esa es `updated_at`.

## Cómo hacerlo

`internal/store` con `go-redis`. `Apply` hace `HSET` de los campos que vienen en el update y `EXPIRE` de la clave. En un pipeline, los dos comandos salen juntos.

Lectura previa: para saber si el nuevo precio mejora el guardado, `Apply` de negocio necesita el snapshot anterior. El store hace `HGETALL`, llama a `cell.Apply` y escribe. Como un solo goroutine ejecuta `Apply`, no hace falta un script Lua para esta versión. El test de carrera no entra en el alcance.

Cantidad ausente: si el update viene del API, no se manda `sell_amount` ni `buy_amount`. Un `HSET` parcial no debe ponerlos en `0`. Cero se leería como «no hay stock».

Precio cero no se escribe. Si el lado no trae precio, ese campo se omite.

`Stale(olderThan, limit)` recorre las claves `west:*` con `SCAN`, lee `updated_at` y devuelve como máximo `limit` celdas más viejas que el umbral. Hace falta para el respaldo. No se usa `KEYS`. Las claves `alert:`, `alerts:` y `alert-owner:` no entran en ese barrido.

## Resultado esperado

Después de una venta NATS, `HGETALL` devuelve `sell_min`, `sell_amount`, `sell_avg`, `updated_at=nats` y un TTL cercano a `CELL_TTL`. El lado compra no aparece todavía.

Un update de API posterior escribe `sell_min` y `source=api` sin crear `sell_amount`. Si la celda ya tenía cantidad de NATS y el API no trae cantidad, la cantidad anterior se deja.

## Pruebas

`miniredis` en `store_test.go`. No hay Redis real en `go test`.

| Caso | Esperado |
|---|---|
| primera offer | hash con venta y TTL |
| offer más barata | `sell_min` baja y `sell_avg` cambia |
| offer más cara | hash igual |
| API sin cantidad sobre celda nueva | hay `sell_min`, no hay `sell_amount` |
| API sobre celda con amount 15 | amount sigue 15 |
| `Stale` con dos celdas, una vieja | solo la vieja, respetando `limit` |
| precio 0 | la clave no se crea |
