# Arbitraje

## Qué es

`/arbitrage` responde dónde comprar un objeto y dónde venderlo al instante. En Discord, con el cliente en español, el comando se ve como **Arbitraje**.

No pide ciudad. Recorre las ocho y elige la pareja con mayor margen. Comprar es pagar la venta listada de una ciudad. Vender es cobrar la orden de compra de otra ciudad. El margen es la diferencia. El viaje, el impuesto y el riesgo no entran.

Si la mejor orden de compra está en la misma ciudad que la venta más barata, esa compra no se usa para esa venta. Se prueba el resto de parejas. Gana la que deja más plata, no la venta más baja seguida de la compra más alta.

## Cómo hacerlo

El comando tiene `item`, `quality` y `enchantment`. No tiene `city`. `item` usa el mismo autocompletado que `price`. Calidad y encantamiento son opcionales. Si no vienen, se usa Normal y 0, y el mensaje lleva los botones para cambiarlos. Si el usuario elige uno de los dos, la respuesta queda fija, sin botones.

`InteractionHandler` pide `PricesService.get` sin ciudades, así que lee las ocho celdas. Si Redis no tiene una, entra el mismo respaldo del API West que usa `/price`. `findArbitrage` en `src/prices/arbitrage.ts` elige la ruta. `buildArbitrageEmbed` arma el embed.

La respuesta es un embed: título con el nombre, una línea de calidad, encantamiento y frescura, y tres filas.

```text
Comprar en Martlock    12.855
Vender en Caerleon     15.133
Margen                  2.278
```

`Reciente` exige que las dos celdas estén dentro de `FRESH_WITHIN`. Si una está vieja, dice `Desactualizado`. Si ninguna pareja deja margen positivo, el texto es «No hay ruta» y no muestra un cero.

Los botones usan los prefijos `aq:` y `ae:`. Los de `/price` siguen en `pq:` y `pe:`. Discord recibe el aviso al momento (`type` 5) y el mensaje se edita cuando la ruta está lista, igual que el precio.

El registro va en el mismo `PUT` de `npm run register:commands`, junto con `price`. No hay un script aparte.

## Resultado esperado

`T5_BAG` en Normal y encantamiento 0, con Martlock vendiendo a 12.855 y Caerleon comprando a 15.133, y sin una pareja mejor, muestra comprar en Martlock, vender en Caerleon y margen 2.278.

Si todas las compras están por debajo de las ventas de las otras ciudades, no hay ruta.

## Pruebas

`arbitrage.spec.ts` cubre la pareja que no es «la venta más baja y la compra más alta», el caso sin margen y una pata desactualizada.

`arbitrage.embed.spec.ts` cubre las tres filas y el texto de «No hay ruta».

`interaction-handler.service.spec.ts` comprueba que el comando pide las ocho ciudades y que, con una sola ciudad con dato, responde que no hay ruta.
