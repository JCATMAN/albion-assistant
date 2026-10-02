# Mensaje de orden

## Qué es

El JSON de `marketorders.deduped` es una orden ya deduplicada. `UnitPriceSilver` llega en plata, no en unidades internas. `AuctionType` es `offer` (venta) o `request` (compra).

Ejemplo real de campos:

```json
{
  "Id": 12226808117,
  "ItemTypeId": "T4_BAG@1",
  "ItemGroupTypeId": "T4_BAG",
  "LocationId": 3005,
  "QualityLevel": 1,
  "EnchantmentLevel": 1,
  "UnitPriceSilver": 4978,
  "Amount": 15,
  "AuctionType": "offer",
  "Expires": "2026-10-15T00:24:27"
}
```

`LocationId` a veces llega como número y a veces como string (`"3005"`), según la versión del publicador. Hay que aceptar los dos.

## Cómo hacerlo

`order.Parse([]byte) (Order, error)` en `internal/order`.

Reglas de descarte (`ok == false`, sin error de programa):

- `ItemTypeId` vacío.
- `UnitPriceSilver` menor o igual a 0.
- `Amount` menor o igual a 0.
- `AuctionType` distinto de `offer` y `request`.
- `QualityLevel` fuera de 1–5.
- `EnchantmentLevel` fuera de 0–4.
- `LocationId` que no se pueda leer como entero.

Normalización del ítem:

- `T4_BAG@1` se parte en base `T4_BAG` y encantamiento 1.
- Si el sufijo `@N` y `EnchantmentLevel` discrepan, gana el sufijo del `ItemTypeId`. Es el identificador que usa el render y el catálogo.
- El base no lleva `@`. La celda guarda el encantamiento en su propio segmento.

`Expires` se conserva para un descarte futuro. En esta versión una orden ya expirada (`Expires` anterior a ahora) se descarta.

## Resultado esperado

```go
got, err := order.Parse(raw)
```

Para el JSON de arriba: `err == nil`, `Item == "T4_BAG"`, `Enchant == 1`, `Location == 3005`, `Side == Sell`, `Price == 4978`, `Amount == 15`, `Quality == 1`.

`{"UnitPriceSilver": 10000}` sin el resto no produce una orden. No se divide otra vez entre 10.000.

## Pruebas

Tabla `parse_test.go`:

| Caso | Resultado |
|---|---|
| JSON del ejemplo | orden de venta, base sin `@` |
| `LocationId` string `"3008"` | `Location == 3008` |
| `AuctionType=request` | lado compra |
| precio 0, cantidad 0, calidad 6, encantamiento 5 | descartada |
| `T4_BAG` con `EnchantmentLevel=2` | base `T4_BAG`, encantamiento 2 |
| `T4_BAG@1` con `EnchantmentLevel=0` | encantamiento 1 |
| JSON truncado | error de parseo, no un panic |
| `Expires` en el pasado | descartada |
