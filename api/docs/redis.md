# Lectura en Redis

## Qué es

Las celdas las escribe `nats/`. Esta API solo hace `HGETALL`. La clave es la misma:

```text
west:{uniqueName}:{city}:q{quality}:e{enchantment}
```

Ejemplo: `west:T4_BAG:Caerleon:q1:e1`. `Black Market` y `Fort Sterling` llevan su espacio. El `uniqueName` de la clave es el base, sin `@`. El encantamiento va en `e`.

Hash: `sell_min`, `sell_amount`, `sell_avg`, `buy_max`, `buy_amount`, `buy_avg`, `updated_at`, `source`. Un campo ausente no es un cero. El API de Albion no guarda cantidad, y un cero se leería como stock vacío.

Los avisos no usan esta hash. Sus claves están en [aviso.md](aviso.md).

## Cómo hacerlo

`cellKey(input: CellKeyInput): string` es pura. `PriceRepository` usa `ioredis` con `REDIS_URL`. `getMany(keys: string[])` abre un pipeline de `HGETALL` y devuelve un `Map`.

```typescript
type StoredCell = {
  sellMin: number | null;
  sellAmount: number | null;
  sellAvg: number | null;
  buyMax: number | null;
  buyAmount: number | null;
  buyAvg: number | null;
  updatedAt: number | null;
  source: 'nats' | 'api' | null;
};
```

Una clave que no existe entra al mapa como todos los campos `null`. El repositorio no decide si está fresca. Eso lo hace el servicio de precios con `FRESH_WITHIN`.

No hay `SCAN` de toda la instancia. Solo se piden las claves que el servicio ya armó. Así no se recorre lo demás que haya en el Redis del VPS.

## Resultado esperado

Pedir `T4_BAG` en Caerleon, calidad 1, encantamiento 0 lee exactamente `west:T4_BAG:Caerleon:q1:e0`. Un hash con `sell_min=4978` y sin `sell_amount` llega como `sellMin: 4978` y `sellAmount: null`.

## Pruebas

`cell-key.spec.ts`: encantamiento 0, encantamiento 1, ciudad con espacio, base al que le sobraba `@1`.

`price.repository.spec.ts` usa `ioredis-mock` o un cliente falso con un pipeline que devuelve hashes fijos. No hay Redis del VPS en `npm test`. Casos: clave presente, clave ausente, campo de cantidad ausente.
