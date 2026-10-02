# Celda

## Qué es

La unidad que se guarda. No es «el precio del producto». Es el mejor precio listado ahora para un ítem, una ciudad, una calidad y un encantamiento.

```text
west:T4_BAG:Caerleon:q1:e1
```

`e1` es el encantamiento. `T4_BAG` y `T4_BAG@1` comparten base y se distinguen por `e`.

## Cómo hacerlo

`cell.Key` arma el string. Segmentos: región fija `west`, base del ítem, ciudad, `q` + calidad, `e` + encantamiento. Sin espacios extra. La ciudad ya viene canonicalizada.

`cell.Apply(prev Snapshot, in Order) (Snapshot, bool)` decide el siguiente estado en memoria. `bool` dice si el mejor precio de ese lado cambió. Ese flag lo usa el promedio.

Reglas:

- `offer` solo toca el lado venta. `request` solo toca el lado compra.
- Venta: si no había precio o el nuevo es **menor**, ese pasa a ser `sell_min` y `sell_amount` es la cantidad de esta orden. Un precio más caro se ignora.
- Compra: si no había precio o el nuevo es **mayor**, ese pasa a ser `buy_max`.
- Misma cifra de precio con otra cantidad: se actualiza la cantidad y el flag de cambio de precio queda en false. El promedio no se mueve.
- `source` de este camino es `nats`.
- `updated_at` es el reloj que recibe la función, no `time.Now()` escondido. El test controla el instante.

No se suma la cantidad de todas las órdenes a ese precio. Guardamos la cantidad de la orden que fijó el mejor precio. El libro completo no entra en esta versión.

## Resultado esperado

Partiendo de una celda vacía, una `offer` a 4978 con cantidad 15 deja `SellMin=4978`, `SellAmount=15` y `changed=true`. Otra `offer` a 5200 no cambia el mínimo. Otra a 4800 lo baja y `changed=true`. Una `request` a 3000 llena `BuyMax` sin tocar la venta.

La clave de esa orden en Caerleon, calidad 1, encantamiento 1 es `west:T4_BAG:Caerleon:q1:e1`.

## Pruebas

Tabla sobre `Apply`, sin Redis:

| Estado previo | Orden | Esperado |
|---|---|---|
| vacío | offer 4978 x15 | sell 4978, changed |
| sell 4978 | offer 5200 | sigue 4978, no changed |
| sell 4978 | offer 4800 x4 | sell 4800, changed |
| sell 4978 x15 | offer 4978 x40 | amount 40, no changed |
| sell 4978 | request 3000 | buy 3000, sell intacto, changed en compra |
| buy 3000 | request 2500 | buy sigue 3000 |

Y un test de `Key` con encantamiento 0 (`e0`) y con ciudad `Black Market` (`west:T4_BAG:Black Market:q1:e0`). El espacio forma parte de la clave. `api/` tiene que usar el mismo formato.
