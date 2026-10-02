/** Injection token for the price store. Services depend on this, not on ioredis. */
export const PRICE_REPOSITORY = Symbol('PRICE_REPOSITORY');

export interface StoredCell {
  sellMin: number | null;
  sellAmount: number | null;
  sellAvg: number | null;
  buyMax: number | null;
  buyAmount: number | null;
  buyAvg: number | null;
  updatedAt: number | null;
  source: 'nats' | 'api' | null;
}

export interface PriceRepository {
  getMany(keys: string[]): Promise<Map<string, StoredCell>>;
}

/** A cell with every field absent. Missing hashes use this instead of zeros. */
export function emptyStoredCell(): StoredCell {
  return {
    sellMin: null,
    sellAmount: null,
    sellAvg: null,
    buyMax: null,
    buyAmount: null,
    buyAvg: null,
    updatedAt: null,
    source: null,
  };
}
