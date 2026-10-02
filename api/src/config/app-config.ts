/** Typed settings parsed once at startup. Services inject this instead of process.env. */
export class AppConfig {
  readonly port: number;
  readonly redisUrl: string;
  readonly itemsUrl: string;
  readonly freshWithinMilliseconds: number;
  readonly discordPublicKey: string;
  readonly catalogRefreshMilliseconds: number;

  constructor(values: {
    port: number;
    redisUrl: string;
    itemsUrl: string;
    freshWithinMilliseconds: number;
    discordPublicKey: string;
    catalogRefreshMilliseconds: number;
  }) {
    this.port = values.port;
    this.redisUrl = values.redisUrl;
    this.itemsUrl = values.itemsUrl;
    this.freshWithinMilliseconds = values.freshWithinMilliseconds;
    this.discordPublicKey = values.discordPublicKey;
    this.catalogRefreshMilliseconds = values.catalogRefreshMilliseconds;
  }
}
