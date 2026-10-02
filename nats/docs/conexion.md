# Conexión NATS

## Qué es

Una suscripción al topic deduplicado de Américas. El proceso no publica. Si el servidor NATS se va, el cliente reintenta y el resto del programa sigue vivo para poder usar el API.

## Cómo hacerlo

`internal/conn` abre `nats.go` con `nats.Connect(url, nats.MaxReconnects(-1), nats.ReconnectWait(2*time.Second))`.

Handlers:

- `DisconnectErrHandler` marca `alive=false`.
- `ReconnectHandler` marca `alive=true`.

`Subscribe(subject, cb)` no procesa el mercado dentro del callback. Decodifica con [orden.md](orden.md) y manda el resultado a un canal. Si el JSON es inválido, se cuenta y se descarta. Un mensaje malo no cierra la suscripción.

Subject fijo de esta versión: `marketorders.deduped`. No suscribirse a `marketorders.ingest` ni a `marketorders.deduped.bulk`. El ingest trae duplicados y la plata sin dividir. El bulk es el mismo dato repetido en lote.

`Alive() bool` lo consulta el loop de respaldo.

## Resultado esperado

Con NATS alcanzable, cada mensaje válido aparece una vez en el canal de órdenes. Al cortar la red, `Alive()` pasa a false y `Run` no retorna. Al volver la red, `Alive()` pasa a true y la suscripción sigue siendo la misma.

El payload que sale del callback ya está parseado. El loop no ve `[]byte`.

## Pruebas

Levantar `nats-server` embebido solo si se quiere un test de integración etiquetado `//go:build integration`. El test de unidad no lo usa.

Unidad: un fake de la conexión no hace falta si el decode está en `order`. El test de `conn` que sí vale sin red es el de «callback con JSON roto no cierra y no empuja al canal». Se puede extraer `handle(msg []byte, out chan<- order.Order) error` y probarla con una tabla: JSON válido empuja una orden, `{}` no empuja, body vacío no empuja.

No afirmar en un test de unidad que el host público está arriba.
