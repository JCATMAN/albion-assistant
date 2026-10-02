# Iconos

## Qué es

Ni Redis ni el catálogo traen el PNG. El icono es una URL del render del juego. Discord la descarga al mostrar el embed. Este proceso no guarda ni reenvía la imagen.

Documentación del render: [API:Render service](https://wiki.albiononline.com/wiki/API:Render_service).

## Cómo hacerlo

`iconUrl` en `icon-url.ts`:

```typescript
function iconUrl(uniqueName: string, quality: number, size = 100): string
```

```text
https://render.albiononline.com/v1/item/T4_BAG@1.png?quality=2&size=100
```

El `@N` solo se agrega si el encantamiento es mayor a 0. `quality` va de 1 a 5. `size` default 100, tope 217. El `uniqueName` que llega puede traer ya el `@`; no se duplica.

Si el render no responde, el precio se sigue devolviendo. La URL se arma igual. Quien pinta decide qué hacer si la imagen falla.

## Resultado esperado

| Entrada | URL |
|---|---|
| `T4_BAG`, encantamiento 0, calidad 1 | `.../T4_BAG.png?quality=1&size=100` |
| `T4_BAG`, encantamiento 1, calidad 2 | `.../T4_BAG@1.png?quality=2&size=100` |
| `T4_BAG@1` ya con sufijo, calidad 2 | la misma URL, un solo `@1` |

## Pruebas

Tabla en `icon-url.spec.ts` con las tres filas, más calidad 0 (se usa 1) y size 400 (se recorta a 217). Sin HTTP.
