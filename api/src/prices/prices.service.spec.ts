import 'reflect-metadata';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CatalogItem } from '../catalog/item-name.index';
import { CatalogService } from '../catalog/catalog.service';
import { MARKET_CITIES } from '../catalog/market-cities';
import { AppConfig } from '../config/app-config';
import { ALBION_PRICES, AlbionListedPrice, AlbionPrices } from './albion-prices';
import { CLOCK } from './clock';
import {
  emptyStoredCell,
  PRICE_REPOSITORY,
  PriceRepository,
  StoredCell,
} from './price.repository';
import { PricesService } from './prices.service';

const now = new Date('2026-06-01T12:00:00.000Z');
const recentSeconds = Math.floor(now.getTime() / 1000) - 60;
const staleSeconds = Math.floor(now.getTime() / 1000) - 2 * 60 * 60;

const bag: CatalogItem = {
  uniqueName: 'T4_BAG',
  tier: 4,
  names: { es: 'Bolsa del iniciado', en: "Adept's Bag" },
};

function stored(overrides: Partial<StoredCell> = {}): StoredCell {
  return { ...emptyStoredCell(), ...overrides };
}

describe('PricesService', () => {
  const cells = new Map<string, StoredCell>();
  const seenKeys: string[][] = [];
  let failReads = false;
  const repository: PriceRepository = {
    getMany: (keys) => {
      if (failReads) {
        return Promise.reject(new Error('connection refused'));
      }
      seenKeys.push(keys);
      const result = new Map<string, StoredCell>();
      for (const key of keys) {
        result.set(key, cells.get(key) ?? emptyStoredCell());
      }
      return Promise.resolve(result);
    },
    saveApiPrices: () => Promise.resolve(),
  };
  const albionPrices: AlbionPrices = {
    current: () => Promise.resolve([]),
  };

  let service: PricesService;

  beforeEach(async () => {
    cells.clear();
    seenKeys.length = 0;
    failReads = false;
    albionPrices.current = () => Promise.resolve([]);
    repository.saveApiPrices = () => Promise.resolve();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PricesService,
        { provide: PRICE_REPOSITORY, useValue: repository },
        {
          provide: CatalogService,
          useValue: {
            findByUniqueName: (uniqueName: string) =>
              uniqueName === 'T4_BAG' ? bag : undefined,
          },
        },
        {
          provide: AppConfig,
          useValue: new AppConfig({
            port: 3000,
            redisUrl: 'redis://localhost:6379',
            itemsUrl: 'http://catalog.test/items.json',
            freshWithinMilliseconds: 30 * 60 * 1000,
            discordPublicKey: 'public-key',
            catalogRefreshMilliseconds: 60 * 60 * 1000,
          }),
        },
        { provide: CLOCK, useValue: () => now },
        { provide: ALBION_PRICES, useValue: albionPrices },
      ],
    }).compile();
    service = moduleRef.get(PricesService);
  });

  it('marks a recent hash as fresh and returns prices and amounts', async () => {
    cells.set(
      'west:T4_BAG:Caerleon:q1:e1',
      stored({
        sellMin: 4978,
        sellAmount: 12,
        sellAvg: 4800,
        buyMax: 3200,
        buyAmount: 4,
        buyAvg: 3000,
        updatedAt: recentSeconds,
        source: 'nats',
      }),
    );

    const response = await service.get({
      item: 'T4_BAG@1',
      cities: 'Caerleon',
      qualities: '1',
      locale: 'es',
    });

    expect(response.uniqueName).toBe('T4_BAG@1');
    expect(response.name).toBe('Bolsa del iniciado');
    expect(response.cells).toHaveLength(1);
    expect(response.cells[0]).toMatchObject({
      city: 'Caerleon',
      quality: 1,
      enchantment: 1,
      sellMin: 4978,
      sellAmount: 12,
      buyMax: 3200,
      source: 'nats',
      status: 'fresh',
      updatedAt: new Date(recentSeconds * 1000).toISOString(),
    });
    expect(response.cells[0]?.iconUrl).toContain('T4_BAG@1');
  });

  it('marks a two-hour-old hash as stale when the threshold is 30 minutes', async () => {
    cells.set(
      'west:T4_BAG:Caerleon:q1:e0',
      stored({
        sellMin: 100,
        buyMax: 50,
        updatedAt: staleSeconds,
        source: 'nats',
      }),
    );

    const response = await service.get({
      item: 'T4_BAG',
      cities: 'Caerleon',
    });

    expect(response.cells[0]?.status).toBe('stale');
    expect(response.cells[0]?.sellMin).toBe(100);
  });

  it('fills an absent key from the West API and stores it', async () => {
    const listed: AlbionListedPrice[] = [
      { city: 'Caerleon', quality: 1, sellMin: 4978, buyMax: 3000 },
    ];
    albionPrices.current = jest.fn(() => Promise.resolve(listed));
    const saved: unknown[] = [];
    repository.saveApiPrices = (writes) => {
      saved.push(writes);
      return Promise.resolve();
    };

    const response = await service.get({
      item: 'T4_BAG',
      cities: 'Caerleon',
      qualities: '1',
      locale: 'es',
    });

    expect(albionPrices.current).toHaveBeenCalledWith(
      'T4_BAG',
      ['Caerleon'],
      [1],
    );
    expect(saved).toHaveLength(1);
    expect(response.cells[0]).toMatchObject({
      sellMin: 4978,
      buyMax: 3000,
      sellAmount: null,
      source: 'api',
      status: 'fresh',
    });
  });

  it('marks an absent key as missing and still returns an icon', async () => {
    const response = await service.get({
      item: 'T4_BAG',
      cities: 'Caerleon',
    });

    expect(response.cells[0]).toMatchObject({
      status: 'missing',
      sellMin: null,
      buyMax: null,
      sellAmount: null,
    });
    expect(response.cells[0]?.iconUrl).toContain(
      'https://render.albiononline.com/v1/item/T4_BAG.png',
    );
  });

  it('treats a stored price of 0 as absent', async () => {
    cells.set(
      'west:T4_BAG:Caerleon:q1:e0',
      stored({
        sellMin: 0,
        buyMax: 0,
        updatedAt: recentSeconds,
        source: 'nats',
      }),
    );

    const response = await service.get({
      item: 'T4_BAG',
      cities: 'Caerleon',
    });

    expect(response.cells[0]?.status).toBe('missing');
    expect(response.cells[0]?.sellMin).toBeNull();
    expect(response.cells[0]?.buyMax).toBeNull();
  });

  it('keeps a null amount when only sell_min is present from the api', async () => {
    cells.set(
      'west:T4_BAG:Caerleon:q1:e0',
      stored({
        sellMin: 4978,
        sellAmount: null,
        updatedAt: recentSeconds,
        source: 'api',
      }),
    );

    const response = await service.get({
      item: 'T4_BAG',
      cities: 'Caerleon',
    });

    expect(response.cells[0]).toMatchObject({
      status: 'fresh',
      sellMin: 4978,
      sellAmount: null,
      buyMax: null,
      source: 'api',
    });
  });

  it('returns one cell for each of the eight cities when cities is omitted', async () => {
    const response = await service.get({ item: 'T4_BAG' });

    expect(response.cells.map((cell) => cell.city)).toEqual([...MARKET_CITIES]);
    expect(seenKeys[0]).toHaveLength(8);
    expect(seenKeys[0]).toContain('west:T4_BAG:Black Market:q1:e0');
    expect(seenKeys[0]).toContain('west:T4_BAG:Fort Sterling:q1:e0');
    expect(response.cells.every((cell) => cell.quality === 1)).toBe(true);
  });

  it('lets the enchantment query win over the item suffix', async () => {
    await service.get({
      item: 'T4_BAG@1',
      cities: 'Caerleon',
      enchantment: 0,
    });

    expect(seenKeys[0]).toEqual(['west:T4_BAG:Caerleon:q1:e0']);
  });

  it('uses the id as the name when the catalog does not know the item', async () => {
    const response = await service.get({
      item: 'T7_UNKNOWN',
      cities: 'Caerleon',
    });

    expect(response.name).toBe('T7_UNKNOWN');
    expect(response.cells[0]?.status).toBe('missing');
    expect(response.cells[0]?.iconUrl).toContain('T7_UNKNOWN');
  });

  it('fails clearly when Redis cannot be read', async () => {
    failReads = true;
    const error: unknown = await service
      .get({ item: 'T4_BAG', cities: 'Caerleon' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    if (!(error instanceof ServiceUnavailableException)) {
      throw new Error('expected ServiceUnavailableException');
    }
    expect(error.message).toBe('Redis is unavailable');
    expect(error.getStatus()).toBe(503);
  });

  it('throws BadRequestException for an unknown city', async () => {
    const error: unknown = await service
      .get({ item: 'T4_BAG', cities: 'Atlantis' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    if (!(error instanceof BadRequestException)) {
      throw new Error('expected BadRequestException');
    }
    expect(error.getStatus()).toBe(400);
  });
});
