# Aviso

## Qué es

Cuando el mejor precio de una celda cambia y cruza un aviso guardado por el API, este proceso publica un mensaje en el canal de Discord y borra el aviso. No hay cron ni gateway. Es un `POST` a la API de Discord con `DISCORD_TOKEN`.

La venta cruza si el nuevo `sell_min` es menor o igual que el objetivo. La compra cruza si el nuevo `buy_max` es mayor o igual. Un update que no mueve el mejor precio no avisa. Una orden peor, que NATS ignora, tampoco.

Si Discord rechaza el mensaje, el aviso se queda. El siguiente cambio de precio lo intenta otra vez. Sin `DISCORD_TOKEN` el writer arranca igual y escribe en el log que los avisos están apagados.

## Cómo hacerlo

El API escribe las claves. Este proceso solo las lee. El contrato está en [api/docs/aviso.md](../../api/docs/aviso.md).

Después de un `Apply` que cambió la venta o la compra, `app` pide `alert.Book.Due` con el objeto y el precio nuevo. `Due` hace `SMEMBERS` de `alerts:item:{objeto}` y `HGETALL` de cada `alert:{id}`. Un campo `*` acepta cualquier ciudad, calidad o encantamiento. Los que cruzan se mandan con `discord.Sender` a `POST /channels/{canal}/messages`. El cuerpo es `content` con la mención `<@usuario>` y la celda que cruzó. Si Discord responde 2xx, `Remove` borra el hash, el set y `alert-owner`.

El token entra por `DISCORD_TOKEN` en el entorno del writer. No va en el repositorio. El bot tiene que estar en el servidor y poder escribir en ese canal.

Una bajada de venta llega con la orden NATS. Una orden barata que desaparece no llega por NATS: el respaldo del API puede bajar o subir el precio hasta 30 minutos después, y ese `Apply` también revisa los avisos.

## Resultado esperado

Un aviso de venta a 13.000 para `T4_BAG` en cualquier ciudad, y una venta nueva de 12.000 en Martlock, publica la mención de esa celda y deja Redis sin ese id. Una venta de 14.000 no lo toca. Un aviso limitado a Caerleon no sale por Martlock.

## Pruebas

`alert_test.go` cubre el cruce, el texto y las claves.

`book_test.go` cubre la lectura del set y el borrado.

`send_test.go` cubre el `POST` con el token y un HTTP 403.

`run_test.go` cubre que una orden de venta envía el aviso y lo borra.
