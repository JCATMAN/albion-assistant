/** Current Americas prices used when Redis has no cell yet. */
export const ALBION_PRICES = Symbol('ALBION_PRICES');

export interface AlbionListedPrice {
  city: string;
  quality: number;
  sellMin: number | null;
  buyMax: number | null;
}

export interface AlbionPrices {
  current(
    item: string,
    cities: string[],
    qualities: number[],
  ): Promise<AlbionListedPrice[]>;
}

/** Reads /api/v2/stats/prices for one item. A zero or a year-1 date is absent. */
export class HttpAlbionPrices implements AlbionPrices {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async current(
    item: string,
    cities: string[],
    qualities: number[],
  ): Promise<AlbionListedPrice[]> {
    const response = await this.fetchImpl(priceUrl(this.baseUrl, item, cities, qualities), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) {
      throw new Error(`Albion prices failed with HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    return listedPrices(payload);
  }
}

/** Builds the West stats URL. Cities keep their spaces escaped. */
export function priceUrl(
  baseUrl: string,
  item: string,
  cities: string[],
  qualities: number[],
): string {
  const locations = cities.map((city) => encodeURIComponent(city)).join(',');
  const qualityList = qualities.join(',');
  return `${baseUrl.replace(/\/$/, '')}/api/v2/stats/prices/${item}.json?locations=${locations}&qualities=${qualityList}`;
}

/** Keeps only sides the Data Project has actually seen. */
export function listedPrices(payload: unknown): AlbionListedPrice[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const prices: AlbionListedPrice[] = [];
  for (const entry of payload) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }
    const city = record.city;
    const quality = record.quality;
    if (typeof city !== 'string' || typeof quality !== 'number') {
      continue;
    }
    const sellMin = seenPrice(record.sell_price_min, record.sell_price_min_date);
    const buyMax = seenPrice(record.buy_price_max, record.buy_price_max_date);
    if (sellMin === null && buyMax === null) {
      continue;
    }
    prices.push({ city, quality, sellMin, buyMax });
  }
  return prices;
}

function seenPrice(price: unknown, date: unknown): number | null {
  if (typeof price !== 'number' || price <= 0) {
    return null;
  }
  if (typeof date === 'string' && date.startsWith('0001-01-01')) {
    return null;
  }
  return price;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}
