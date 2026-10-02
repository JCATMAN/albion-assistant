# Parser de búsqueda

## Qué es

El texto que escribe una persona no es el nombre del juego. `bolsa t4.1` significa texto `bolsa`, tier 4, encantamiento 1. El catálogo llama a ese ítem «Bolsa del iniciado». Ni el español ni el inglés contienen `t4` ni `.1`.

## Cómo hacerlo

`parseItemQuery(input: string): ParsedQuery` en `item-query.parser.ts`. No usa Nest ni el catálogo. Solo parte la frase.

```typescript
type ParsedQuery = {
  text: string;
  tier?: number;
  enchantment?: number;
  quality?: number;
  city?: string;
};
```

Reconoce, y los saca del texto:

| Entrada | Campo |
|---|---|
| `t4.1`, `T4.1`, `4.1`, `t4@1` | tier 4, encantamiento 1 |
| `t4`, `T4` | tier 4, sin encantamiento |
| `q1` … `q5` | calidad |
| `normal`, `good`, `outstanding`, `excellent`, `masterpiece` | calidad 1–5 |
| `normal`, `buena`, `destacada`, `excelente`, `obra maestra` | calidad 1–5 |
| `caerleon`, `martlock`, `bridgewatch`, `lymhurst`, `thetford`, `fort sterling`, `black market`, `brecilien` | `city` con el nombre canónico de la celda |

La ciudad canónica es la de Redis: `Fort Sterling`, `Black Market`, `Caerleon`. El resto del string, ya sin esos tokens, es `text`, en minúsculas y sin acentos.

Tier fuera de 2–8 o encantamiento fuera de 0–4 no se aplican: se dejan en el texto para no tragarse un número suelto. Calidad fuera de 1–5 se ignora igual.

## Resultado esperado

| Frase | Resultado |
|---|---|
| `bolsa t4.1` | text `bolsa`, tier 4, enchantment 1 |
| `adept bag t4` | text `adept bag`, tier 4 |
| `bolsa excelente caerleon` | text `bolsa`, quality 4, city `Caerleon` |
| `T4_BAG@1` | text vacío, y el llamador trata el token como `uniqueName` si `get` lo encuentra |
| `` | text vacío, sin filtros |

`T4_BAG@1` lo resuelve `CatalogService`: si el string entero es un `uniqueName`, no hace falta el parser. El parser cubre la jerga.

## Pruebas

Tabla en `item-query.parser.spec.ts` con las filas de arriba, más `t4.9` (el 9 no es encantamiento), `BOLSA` y `fort sterling` en medio de la frase. Ningún test descarga el catálogo.
