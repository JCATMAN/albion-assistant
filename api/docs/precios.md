# Precios

## Qué es

`GET /prices` devuelve una celda por cada ciudad, calidad y encantamiento pedidos. Es la lectura que usa Discord al confirmar el comando.

## Cómo hacerlo

```typescript
class PriceQueryDto {
  item: string;             // UniqueName, required
  cities?: string;          // comma-separated canonical names
  qualities?: string;       // comma-separated 1-5
  enchantment?: number;     // 0-4, default from the item suffix or 0
  locale?: 'es' | 'en';
}
```

`PricesService.get(query)`:

1. Separa el base y el encantamiento. Si el DTO trae `enchantment`, gana sobre el sufijo.
2. Ciudades: las pedidas, o las ocho si el parámetro no viene. Thetford, Lymhurst, Bridgewatch, Black Market, Caerleon, Martlock, Fort Sterling, Brecilien. Un nombre fuera de la lista es 400.
3. Calidades: las pedidas, o `1` si no vienen. No se expanden las cinco por defecto: una consulta sin calidad mira la normal.
4. Arma las claves, llama a `PriceRepository.getMany` y marca el estado.

`status`:

| Condición | Estado |
|---|---|
| la clave no existe, o no hay ni `sell_min` ni `buy_max` | `missing` |
| `updated_at` dentro de `FRESH_WITHIN` | `fresh` |
| hay precio, pero `updated_at` es más viejo | `stale` |

Un precio `0` guardado por error se trata como ausente en ese lado. La cantidad `null` no vuelve el estado `missing` si hay precio: el respaldo del API no trae cantidad.

```typescript
type PriceCell = {
  city: string;
  quality: number;
  enchantment: number;
  sellMin: number | null;
  sellAmount: number | null;
  sellAvg: number | null;
  buyMax: number | null;
  buyAmount: number | null;
  buyAvg: number | null;
  updatedAt: string | null;
  source: 'nats' | 'api' | null;
  status: 'fresh' | 'stale' | 'missing';
  iconUrl: string;
};

type PriceResponse = {
  uniqueName: string;
  name: string;
  cells: PriceCell[];
};
```

`updatedAt` sale en ISO-8601. `name` sale del catálogo según `locale`. Si el `uniqueName` no está en el catálogo, `name` es el propio id y la respuesta sigue siendo 200: el precio no depende del texto.

## Resultado esperado

`GET /prices?item=T4_BAG@1&cities=Caerleon&qualities=1&locale=es` devuelve una celda de Caerleon, encantamiento 1, el nombre en español y la URL del icono. Caerleon sin hash es `status: "missing"` con los precios en `null`, no con ceros.

`cities=Atlantis` responde 400. `item` vacío responde 400.

## Pruebas

`prices.service.spec.ts` con un repositorio falso y un reloj inyectado.

| Caso | Esperado |
|---|---|
| hash reciente | `fresh`, precios y cantidad |
| hash de hace dos horas, umbral 30m | `stale` |
| clave ausente | `missing`, icono igual presente |
| solo `sell_min`, sin amount, source `api` | `fresh` o `stale` según la hora, `sellAmount: null` |
| sin `cities` | ocho celdas, una por ciudad |
| ciudad desconocida | el servicio lanza un error que el filtro de Nest convierte en 400 |
