# Aviso

## Qué es

`/alert` guarda un aviso en el canal donde se escribe. En Discord, con el cliente en español, el comando se ve como **Aviso**.

No manda el mensaje más tarde desde la respuesta del comando. Esa respuesta solo confirma que el aviso quedó guardado. El mensaje de verdad lo publica el writer, con el token del bot, cuando el precio cruza el objetivo. El detalle de ese envío está en [nats/docs/aviso.md](../../nats/docs/aviso.md).

La venta avisa cuando `sell_min` baja a la plata pedida o menos. La compra avisa cuando `buy_max` sube a la plata pedida o más. Si el precio ya cruzó en el momento del comando, no se guarda: la respuesta lo dice ahí mismo.

Hay un aviso por persona, celda y lado. Volver a ejecutarlo reemplaza el anterior.

## Cómo hacerlo

El comando pide `item`, `city` y `target`. `side` es opcional y sale en venta. Calidad y encantamiento son opcionales: si no vienen, se usa Normal y el encantamiento del objeto, o 0.

`InteractionHandler` lee el precio actual con `PricesService.get` de esa ciudad. `describeAlert` decide el texto. Si todavía no cruzó, `AlertService.save` escribe Redis:

| Clave | Qué es |
|---|---|
| `alert:{id}` | hash con objeto, nombre, ciudad, calidad, encantamiento, lado, objetivo, canal y usuario |
| `alerts:west:{objeto}:{ciudad}:q{calidad}:e{encantamiento}` | set de ids que miran esa celda |
| `alert-owner:{usuario}:{clave de celda}:{lado}` | el id vigente de esa persona |

El objeto se guarda sin `@`. El encantamiento va en la clave, igual que el precio. Estas claves no llevan TTL: viven hasta que el writer las borra o hasta que otro comando las reemplaza.

El canal y el usuario salen de la interaction (`channel_id` y `member.user.id`). Tienen que ser numéricos. El comando entra en el mismo aviso inmediato que Precio y Arbitraje, porque leer el precio puede tardar.

El registro va en el mismo `PUT` de `npm run register:commands`, junto con `price` y `arbitrage`.

## Resultado esperado

`T4_BAG` en Caerleon, venta, objetivo 4.000, con la venta actual en 4.978, responde «Aviso guardado» y deja el hash. El mismo comando con objetivo 6.000 responde que ya cruzó y no escribe Redis.

## Pruebas

`alert.service.spec.ts` cubre el alta y el reemplazo del aviso anterior.

`alert.reply.spec.ts` cubre el texto de venta pendiente, venta ya cumplida y compra sin precio.

`interaction-handler.service.spec.ts` cubre que el comando guarda el aviso y que no lo guarda si el precio ya cruzó.
