# Promedio

## Qué es

`sell_avg` y `buy_avg` resumen a cómo se ha venido **listando** el mejor precio. No es el promedio de las ventas cerradas. El historial del Data Project queda fuera.

La misma orden puede reaparecer cada unos diez minutos. Si se promediara cada mensaje, ese precio pesaría de más. Solo entra un valor nuevo cuando [celda.md](celda.md) marca que el mejor precio cambió.

## Cómo hacerlo

`average.Next(prev int, price int, alpha float64) int`.

Primera muestra: el promedio nace igual al precio. Las siguientes usan media móvil entera, en plata:

```text
avg = prev + alpha * (price - prev)
```

Alpha sale de `AVG_ALPHA` (default `0.2`). Se redondea al entero más cercano. El cálculo es simétrico para venta y compra, cada uno con su campo.

`Apply` del cell devuelve el lado que cambió. El store solo llama a `Next` para ese lado. Un mensaje que no mejora el mínimo no lee ni escribe el promedio.

## Resultado esperado

Con alpha `0.2`:

- De vacío a 5000, el promedio queda 5000.
- De 5000 con un cambio a 4000, el promedio queda 4800 (`5000 + 0.2 * (4000-5000)`).
- Una repetición a 5000 que no cambia el mínimo deja el promedio donde estaba.

Cabe en la misma hash. No hay otra clave ni otra estructura.

## Pruebas

Tabla de `Next` con alpha `0.2` y `0.5`, incluyendo el primer valor y un precio igual al anterior (el resultado matemático no se mueve). Otro test, en `cell` o en `app` con fake de store, asegura que dos `offer` al mismo precio producen una sola actualización de `sell_avg`.
