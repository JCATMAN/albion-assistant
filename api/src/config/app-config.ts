/** Americas West prices. Used when Redis has no cell for a lookup. */
export const WEST_ALBION_API_BASE = 'https://west.albion-online-data.com';

/** Typed settings parsed once at startup. Services inject this instead of process.env. */
export class AppConfig {
  readonly port: number;
  readonly redisUrl: string;
  readonly itemsUrl: string;
  readonly freshWithinMilliseconds: number;
  readonly discordPublicKey: string;
  readonly catalogRefreshMilliseconds: number;
  readonly albionApiBase: string;

  constructor(values: {
    port: number;
    redisUrl: string;
    itemsUrl: string;
    freshWithinMilliseconds: number;
    discordPublicKey: string;
    catalogRefreshMilliseconds: number;
    albionApiBase?: string;
  }) {
    this.port = values.port;
    this.redisUrl = values.redisUrl;
    this.itemsUrl = values.itemsUrl;
    this.freshWithinMilliseconds = values.freshWithinMilliseconds;
    this.discordPublicKey = values.discordPublicKey;
    this.catalogRefreshMilliseconds = values.catalogRefreshMilliseconds;
    this.albionApiBase = values.albionApiBase ?? WEST_ALBION_API_BASE;
  }
}
