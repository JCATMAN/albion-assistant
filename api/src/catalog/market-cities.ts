/** Americas cities, in the order used by Redis keys and price responses. */
export const MARKET_CITIES = [
  'Thetford',
  'Lymhurst',
  'Bridgewatch',
  'Black Market',
  'Caerleon',
  'Martlock',
  'Fort Sterling',
  'Brecilien',
] as const;

export type MarketCity = (typeof MARKET_CITIES)[number];

/** True when the value is one of the eight canonical city names. */
export function isMarketCity(value: string): value is MarketCity {
  return (MARKET_CITIES as readonly string[]).includes(value);
}
