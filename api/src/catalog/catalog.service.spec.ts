import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppConfig } from '../config/app-config';
import { CATALOG_FETCH, CatalogFetch, CatalogResponse } from './catalog.fetch';
import { CatalogService } from './catalog.service';

const fourItems = [
  {
    UniqueName: 'T4_BAG',
    LocalizedNames: {
      'ES-ES': 'Bolsa del iniciado',
      'EN-US': "Adept's Bag",
    },
  },
  {
    UniqueName: 'T5_BAG',
    LocalizedNames: {
      'ES-ES': 'Bolsa del experto',
      'EN-US': "Expert's Bag",
    },
  },
  {
    UniqueName: 'T6_CAPE',
    LocalizedNames: {
      'ES-ES': 'Capa de soldado',
      'EN-US': 'Soldier Cape',
    },
  },
  {
    UniqueName: 'T8_MAIN_DAGGER',
    LocalizedNames: {
      'ES-ES': 'Daga de duelo',
      'EN-US': 'Dueling Dagger',
    },
  },
];

function ok(body: unknown): CatalogResponse {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  };
}

function failure(): CatalogResponse {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve(null),
  };
}

async function serviceWith(
  fetchCatalog: CatalogFetch,
): Promise<CatalogService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CatalogService,
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
      { provide: CATALOG_FETCH, useValue: fetchCatalog },
    ],
  }).compile();
  return moduleRef.get(CatalogService);
}

describe('CatalogService', () => {
  it('builds the index from a 200 response', async () => {
    const fetchCatalog: CatalogFetch = jest.fn(() =>
      Promise.resolve(ok(fourItems)),
    );
    const service = await serviceWith(fetchCatalog);
    await service.onModuleInit();

    expect(service.suggest('bolsa', 'es')[0]?.uniqueName).toBe('T4_BAG');
    service.onModuleDestroy();
  });

  it('keeps the previous index when a refresh returns 500', async () => {
    const fetchCatalog = jest
      .fn<Promise<CatalogResponse>, [string]>()
      .mockResolvedValueOnce(ok(fourItems))
      .mockResolvedValueOnce(failure());
    const service = await serviceWith(fetchCatalog);
    await service.onModuleInit();
    await service.refreshCatalog();

    expect(service.suggest('bolsa').map((item) => item.uniqueName)).toContain(
      'T4_BAG',
    );
    expect(
      service.suggest('soldier cape').map((item) => item.uniqueName),
    ).toEqual(['T6_CAPE']);
    service.onModuleDestroy();
  });

  it('fails the first download when the catalog responds 500', async () => {
    const service = await serviceWith(() => Promise.resolve(failure()));
    await expect(service.onModuleInit()).rejects.toThrow(
      /Catalog download failed with HTTP 500/,
    );
  });

  it('resolves Spanish slang to the enchanted unique name', async () => {
    const service = await serviceWith(() => Promise.resolve(ok(fourItems)));
    await service.onModuleInit();

    const suggestions = service.suggest('bolsa t4.1');

    expect(suggestions).toEqual([
      {
        uniqueName: 'T4_BAG@1',
        name: 'Bolsa del iniciado',
        tier: 4,
        enchantment: 1,
      },
    ]);
    service.onModuleDestroy();
  });

  it('finds an item from its English name', async () => {
    const service = await serviceWith(() => Promise.resolve(ok(fourItems)));
    await service.onModuleInit();

    expect(service.suggest('soldier cape')).toEqual([
      {
        uniqueName: 'T6_CAPE',
        name: 'Capa de soldado',
        tier: 6,
        enchantment: 0,
      },
    ]);
    service.onModuleDestroy();
  });

  it('returns an exact unique name with its enchantment', async () => {
    const service = await serviceWith(() => Promise.resolve(ok(fourItems)));
    await service.onModuleInit();

    expect(service.suggest('T4_BAG@1')).toEqual([
      {
        uniqueName: 'T4_BAG@1',
        name: 'Bolsa del iniciado',
        tier: 4,
        enchantment: 1,
      },
    ]);
    service.onModuleDestroy();
  });

  it('returns an empty list when the tier matches nothing', async () => {
    const service = await serviceWith(() => Promise.resolve(ok(fourItems)));
    await service.onModuleInit();

    expect(service.suggest('bolsa t8')).toEqual([]);
    service.onModuleDestroy();
  });

  it('uses the English display name when locale is en', async () => {
    const service = await serviceWith(() => Promise.resolve(ok(fourItems)));
    await service.onModuleInit();

    const match = service
      .suggest('bag', 'en')
      .find((item) => item.uniqueName === 'T4_BAG');
    expect(match?.name).toBe("Adept's Bag");
    service.onModuleDestroy();
  });

  it('collapses enchanted copies that share a display name', async () => {
    const copies = [0, 1, 2, 3, 4].map((enchantment) => ({
      UniqueName: enchantment === 0 ? 'T5_BAG' : `T5_BAG@${enchantment}`,
      LocalizedNames: {
        'ES-ES': 'Bolsa del experto',
        'EN-US': "Expert's Bag",
      },
    }));
    const service = await serviceWith(() => Promise.resolve(ok(copies)));
    await service.onModuleInit();

    expect(service.suggest('bolsa del experto')).toEqual([
      {
        uniqueName: 'T5_BAG',
        name: 'Bolsa del experto',
        tier: 5,
        enchantment: 0,
      },
    ]);
    expect(service.suggest('bolsa del experto t5.2')).toEqual([
      {
        uniqueName: 'T5_BAG@2',
        name: 'Bolsa del experto',
        tier: 5,
        enchantment: 2,
      },
    ]);
    service.onModuleDestroy();
  });

  it('cuts suggestions to 25', async () => {
    const potions = Array.from({ length: 26 }, (_unused, index) => ({
      UniqueName: `T4_POTION_${index + 1}`,
      LocalizedNames: {
        'ES-ES': `Poción ${index + 1}`,
        'EN-US': `Potion ${index + 1}`,
      },
    }));
    potions.push({
      UniqueName: 'T4_POTION_GRAN',
      LocalizedNames: {
        'ES-ES': 'Gran poción',
        'EN-US': 'Big potion',
      },
    });
    const service = await serviceWith(() => Promise.resolve(ok(potions)));
    await service.onModuleInit();

    const suggestions = service.suggest('pocion');

    expect(suggestions).toHaveLength(25);
    expect(suggestions[0]?.name.startsWith('Poción')).toBe(true);
    expect(
      suggestions.some((item) => item.uniqueName === 'T4_POTION_GRAN'),
    ).toBe(false);
    service.onModuleDestroy();
  });
});
