# Sugerencias

## Qué es

`GET /items/suggest` devuelve como máximo 25 ítems. Lo usa el autocompletado de Discord y cualquier otro cliente. No lee Redis.

## Cómo hacerlo

`ItemsController` en el módulo `catalog`.

```typescript
class SuggestQueryDto {
  q: string;       // required, max 100
  locale?: 'es' | 'en';
}
```

`CatalogService.suggest(q, locale)` hace:

1. Si `q` es un `uniqueName` exacto, devuelve ese ítem, con el encantamiento del `@N` si venía.
2. Si no, `parseItemQuery`. El `text` restante se busca con `findByToken`. Si hay `tier`, se filtran los que no coinciden.
3. Se ordena por el que empieza por el texto, luego el resto. Se cortan a 25.
4. El encantamiento parseado se copia a cada sugerencia. El `uniqueName` de la respuesta lleva `@N` cuando el encantamiento es mayor a 0 (`T4_BAG@1`). El base del catálogo no se modifica.

```typescript
type ItemSuggestion = {
  uniqueName: string;
  name: string;
  tier: number | null;
  enchantment: number;
};
```

`name` sale de `displayName` según `locale`. Default `es`.

Varias piezas pueden compartir texto. No se elige una al azar. Si `bolsa` con tier 4 deja tres ítems, se devuelven tres.

## Resultado esperado

`GET /items/suggest?q=bolsa%20t4.1&locale=es` incluye una entrada `uniqueName: "T4_BAG@1"` y `name: "Bolsa del iniciado"`, y no incluye bolsas de otro tier. `q` vacío responde 400. Más de 25 candidatos se recortan sin error.

## Pruebas

`catalog.service.spec.ts` con un índice falso de cuatro ítems. Casos: jerga española, nombre inglés, `uniqueName` exacto, tier que deja la lista vacía, recorte a 25, `locale=en`.

`items.controller.spec.ts` comprueba que el DTO rechaza `q` ausente y que el controlador no llama a Redis.
