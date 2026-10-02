import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CatalogLocale, displayName } from '../catalog/item-name.index';
import { CatalogService } from '../catalog/catalog.service';
import { isMarketCity, MARKET_CITIES } from '../catalog/market-cities';
import { AppConfig } from '../config/app-config';
import { ALBION_PRICES, AlbionPrices } from './albion-prices';
import { cellKey } from './cell-key';
import { CLOCK, Clock } from './clock';
import { iconUrl } from './icon-url';
import {
  emptyStoredCell,
  PRICE_REPOSITORY,
  PriceRepository,
  StoredCell,
} from './price.repository';
import { PriceCell, PriceQuery, PriceResponse } from './price.types';

/** Turns stored hashes into priced cells with freshness and icons. */
@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(
    @Inject(PRICE_REPOSITORY) private readonly prices: PriceRepository,
    private readonly catalog: CatalogService,
    private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ALBION_PRICES) private readonly albionPrices: AlbionPrices,
  ) {}

  async get(query: PriceQuery): Promise<PriceResponse> {
    const item = query.item.trim();
    if (!item) {
      throw new BadRequestException('item is required');
    }
    const { baseUniqueName, enchantment } = resolveEnchantment(
      item,
      query.enchantment,
    );
    const cities = parseCities(query.cities);
    const qualities = parseQualities(query.qualities);
    const locale: CatalogLocale = query.locale ?? 'es';
    const uniqueName =
      enchantment > 0 ? `${baseUniqueName}@${enchantment}` : baseUniqueName;
    const named = this.catalog.findByUniqueName(baseUniqueName);
    const name = named ? displayName(named, locale) : uniqueName;

    const keys = cities.flatMap((city) =>
      qualities.map((quality) =>
        cellKey({
          uniqueName: baseUniqueName,
          city,
          quality,
          enchantment,
        }),
      ),
    );
    const storedByKey = await this.readCells(keys);
    await this.fillMissingFromAlbion(
      uniqueName,
      cities,
      qualities,
      enchantment,
      storedByKey,
    );
    const cells: PriceCell[] = [];
    for (const city of cities) {
      for (const quality of qualities) {
        const key = cellKey({
          uniqueName: baseUniqueName,
          city,
          quality,
          enchantment,
        });
        const stored = storedByKey.get(key) ?? emptyStoredCell();
        cells.push(
          this.toCell(stored, {
            city,
            quality,
            enchantment,
            uniqueName,
          }),
        );
      }
    }

    const pricedCount = cells.filter((cell) => cell.status !== 'missing').length;
    const apiCount = cells.filter((cell) => cell.source === 'api').length;
    this.logger.log(
      `price lookup item=${uniqueName} enchantment=${enchantment} cities=${cities.join('|')} qualities=${qualities.join(',')} priced=${pricedCount}/${cells.length} fromApi=${apiCount} keys=${keys.join(',')}`,
    );

    return { uniqueName, name, cells };
  }

  /** Asks the West API for cells Redis has never seen, then stores that observation. */
  private async fillMissingFromAlbion(
    uniqueName: string,
    cities: string[],
    qualities: number[],
    enchantment: number,
    storedByKey: Map<string, StoredCell>,
  ): Promise<void> {
    const missing = cities.flatMap((city) =>
      qualities.filter((quality) => {
        const key = cellKey({
          uniqueName,
          city,
          quality,
          enchantment,
        });
        const stored = storedByKey.get(key) ?? emptyStoredCell();
        return presentPrice(stored.sellMin) === null && presentPrice(stored.buyMax) === null;
      }).map((quality) => ({ city, quality })),
    );
    if (missing.length === 0) {
      return;
    }
    try {
      const listed = await this.albionPrices.current(uniqueName, cities, qualities);
      const observedAtUnix = Math.floor(this.clock().getTime() / 1000);
      const writes = [];
      for (const price of listed) {
        const key = cellKey({
          uniqueName,
          city: price.city,
          quality: price.quality,
          enchantment,
        });
        const stored = storedByKey.get(key) ?? emptyStoredCell();
        if (presentPrice(stored.sellMin) !== null || presentPrice(stored.buyMax) !== null) {
          continue;
        }
        storedByKey.set(key, {
          ...emptyStoredCell(),
          sellMin: price.sellMin,
          sellAvg: price.sellMin,
          buyMax: price.buyMax,
          buyAvg: price.buyMax,
          updatedAt: observedAtUnix,
          source: 'api',
        });
        writes.push({
          key,
          sellMin: price.sellMin,
          buyMax: price.buyMax,
          observedAtUnix,
        });
      }
      await this.prices.saveApiPrices(writes);
      this.logger.log(
        `albion fallback item=${uniqueName} requested=${missing.length} stored=${writes.length}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`albion fallback failed for ${uniqueName}: ${message}`);
    }
  }

  private async readCells(keys: string[]): Promise<Map<string, StoredCell>> {
    try {
      return await this.prices.getMany(keys);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to read prices from Redis', stack);
      throw new ServiceUnavailableException('Redis is unavailable');
    }
  }

  private toCell(
    stored: StoredCell,
    identity: {
      city: string;
      quality: number;
      enchantment: number;
      uniqueName: string;
    },
  ): PriceCell {
    const sellMin = presentPrice(stored.sellMin);
    const buyMax = presentPrice(stored.buyMax);
    const status = this.statusFor(sellMin, buyMax, stored.updatedAt);
    return {
      city: identity.city,
      quality: identity.quality,
      enchantment: identity.enchantment,
      sellMin,
      sellAmount: stored.sellAmount,
      sellAvg: stored.sellAvg,
      buyMax,
      buyAmount: stored.buyAmount,
      buyAvg: stored.buyAvg,
      updatedAt:
        stored.updatedAt === null
          ? null
          : new Date(stored.updatedAt * 1000).toISOString(),
      source: stored.source,
      status,
      iconUrl: iconUrl(identity.uniqueName, identity.quality),
    };
  }

  private statusFor(
    sellMin: number | null,
    buyMax: number | null,
    updatedAt: number | null,
  ): PriceCell['status'] {
    if (sellMin === null && buyMax === null) {
      return 'missing';
    }
    if (updatedAt === null) {
      return 'stale';
    }
    const ageMilliseconds = this.clock().getTime() - updatedAt * 1000;
    if (ageMilliseconds <= this.config.freshWithinMilliseconds) {
      return 'fresh';
    }
    return 'stale';
  }
}

function presentPrice(value: number | null): number | null {
  if (value === null || value === 0) {
    return null;
  }
  return value;
}

function resolveEnchantment(
  item: string,
  override: number | undefined,
): { baseUniqueName: string; enchantment: number } {
  const match = /^(.*)@([0-4])$/.exec(item);
  const baseUniqueName = match?.[1] ?? item;
  const fromSuffix = match?.[2] ? Number(match[2]) : 0;
  return {
    baseUniqueName,
    enchantment: override ?? fromSuffix,
  };
}

function parseCities(cities: string | undefined): string[] {
  if (cities === undefined || cities.trim() === '') {
    return [...MARKET_CITIES];
  }
  const requested = cities
    .split(',')
    .map((city) => city.trim())
    .filter((city) => city.length > 0);
  if (requested.length === 0) {
    return [...MARKET_CITIES];
  }
  for (const city of requested) {
    if (!isMarketCity(city)) {
      throw new BadRequestException(`Unknown city: ${city}`);
    }
  }
  return requested;
}

function parseQualities(qualities: string | undefined): number[] {
  if (qualities === undefined || qualities.trim() === '') {
    return [1];
  }
  const requested = qualities
    .split(',')
    .map((quality) => quality.trim())
    .filter((quality) => quality.length > 0);
  if (requested.length === 0) {
    return [1];
  }
  return requested.map((quality) => {
    if (!/^[1-5]$/.test(quality)) {
      throw new BadRequestException(`Unknown quality: ${quality}`);
    }
    return Number(quality);
  });
}
