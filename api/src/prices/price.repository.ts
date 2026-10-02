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

export interface ApiCellWrite {
  key: string;
  sellMin: number | null;
  buyMax: number | null;
  observedAtUnix: number;
}

export interface PriceRepository {
  getMany(keys: string[]): Promise<Map<string, StoredCell>>;
  /** Stores an API observation. Does not write amounts. */
  saveApiPrices(writes: ApiCellWrite[]): Promise<void>;
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
