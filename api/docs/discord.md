# Discord

## Qué es

Discord llama a este proceso. No hay otro servicio de bot. El slash command se registra con un script. Cada uso llega como `POST /discord/interactions`.

Hay dos comandos. `price` muestra la tabla por ciudad. `arbitrage` busca la ruta de compra y venta; el detalle está en [arbitraje.md](arbitraje.md). Las opciones de `price` se llaman `item`, `city`, `quality` y `enchantment`. `arbitrage` no tiene `city`. Los textos que ve el usuario en español van en las localizaciones de Discord, no en los identificadores.

Documentación: [Application Commands](https://docs.discord.com/developers/interactions/application-commands).

| Opción | Tipo | Notas |
|---|---|---|
| `item` | string, autocomplete | el único campo que busca en el catálogo |
| `city` | string, choices fijos | las ocho ciudades, opcional |
| `quality` | integer, choices 1–5 | opcional |
| `enchantment` | integer, choices 0–4 | opcional |

El autocompletado admite 25 opciones, cada una con `name` y `value` de hasta 100 caracteres, y no admite imagen. Hay que responder en menos de 3 segundos. El icono va en el embed de la respuesta final.

## Cómo hacerlo

`DiscordController` en `POST /discord/interactions`. Esa ruta necesita el body crudo para verificar la firma. El resto de la app puede seguir con JSON parseado.

`DiscordSignatureGuard` comprueba `X-Signature-Ed25519` y `X-Signature-Timestamp` con `DISCORD_PUBLIC_KEY`, usando `discord-interactions` (`verifyKey`). Una firma mala es 401 y no llega al handler.

`InteractionHandler`:

| `type` | Respuesta |
|---|---|
| `1` PING | `{ type: 1 }` |
| `4` autocomplete, opción `item` enfocada | `{ type: 8, data: { choices } }` desde `CatalogService.suggest` |
| `2` comando `price` o `arbitrage` | aviso inmediato y luego el embed, desde `PricesService.get` |

`choices[].name` es el nombre visible (`Bolsa del iniciado · T4.1`). `choices[].value` es el `uniqueName` (`T4_BAG@1`). Si la persona envía el comando con un texto que no es una sola sugerencia, el embed pide que elija una opción. No se adivina.

`embed.builder.ts` arma el embed de precio: título, calidad y encantamiento, tabla de venta y compra, y `thumbnail.url` con `iconUrl`. `arbitrage.embed.ts` arma las tres filas de la ruta. Si todas las celdas faltan, el embed lo dice.

El script `src/discord/register-commands.ts` hace `PUT /applications/{appId}/commands` con `DISCORD_TOKEN` y `DISCORD_APP_ID`. Se corre a mano (`npm run register:commands`), no en cada arranque. El mismo `PUT` registra `price` y `arbitrage`. Las `name_localizations` en `es-ES` muestran «Precio» y «Arbitraje». El `name` por defecto sigue en inglés.

La URL pública del VPS apunta a `https://<host>/discord/interactions`. Sin HTTPS Discord no entrega interactions.

## Resultado esperado

Escribir `bolsa t4` en el comando muestra hasta 25 choices y no lee Redis. Elegir `T4_BAG@1` y enviar muestra el embed con la miniatura `T4_BAG@1` y las celdas de `GET /prices`. Un `POST` sin firma válida no consulta precios.

## Pruebas

`discord-signature.guard.spec.ts`: firma válida pasa, firma rota devuelve 401. Se firma el body en el test con una clave de prueba. No se llama a Discord.

`embed.builder.spec.ts`: una celda `fresh` incluye precios y thumbnail. Todas `missing` no inventan un cero.

`interaction-handler.service.spec.ts` con catálogo y precios falsos: PING, autocomplete de `bolsa t4`, comando con `uniqueName` válido, comando con texto ambiguo. El handler de autocomplete no llama a `PricesService`.
