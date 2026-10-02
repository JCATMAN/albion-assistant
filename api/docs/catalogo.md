# Catálogo

## Qué es

`items.json` del proyecto ao-bin-dumps. Trae `UniqueName` y `LocalizedNames`, entre ellos `ES-ES` y `EN-US`. No trae precios ni imágenes. Se carga al arrancar y se refresca cada `CATALOG_REFRESH`.

Ejemplo: `T4_BAG` es «Bolsa del iniciado» y «Adept's Bag». `T4_BAG@1` tiene el mismo texto. El encantamiento no se busca en el nombre.

## Cómo hacerlo

`CatalogService` descarga el JSON, descarta entradas sin `UniqueName` y construye `ItemNameIndex`.

El índice normaliza cada nombre: minúsculas y sin acentos. Una palabra de `ES-ES` y la misma palabra de `EN-US` apuntan al mismo `UniqueName`. No se traduce de un idioma al otro.

```typescript
type CatalogItem = {
  uniqueName: string;
  tier: number | null;
  names: { es: string | null; en: string | null };
};

type ItemNameIndex = {
  findByToken(token: string): CatalogItem[];
  get(uniqueName: string): CatalogItem | undefined;
};
```

`tier` sale del prefijo `T4`, `T5`, etc. Si no hay prefijo, queda `null`. Los ítems sin ningún `LocalizedNames` (casi todos de misión) no entran al índice de texto. Siguen en `get` por si alguien pide el id directo.

`displayName(item, locale)` devuelve `es` o `en`. Si el pedido no tiene texto, usa el otro. Si no hay ninguno, devuelve el `uniqueName`.

El refresh no deja el índice vacío si la descarga falla: se queda el anterior y se loguea el error.

## Resultado esperado

Después de cargar, `findByToken("bolsa")` incluye `T4_BAG` y también `findByToken("bag")` incluye `T4_BAG`. `get("T4_BAG")` devuelve los dos nombres. Un `uniqueName` desconocido devuelve `undefined`.

## Pruebas

`item-name.index.spec.ts` con un array de tres ítems fijos, no con el JSON real. Casos: token en español, token en inglés, acento (`vision` encuentra «visión»), ítem sin nombres, `displayName` con `es`, con `en` y con el idioma vacío.

`CatalogService` se prueba con un `fetch` inyectado. Una respuesta 200 construye el índice. Una 500 en el refresh conserva el índice previo.
