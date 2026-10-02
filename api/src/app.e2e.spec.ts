import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { CATALOG_FETCH, CatalogFetch } from './catalog/catalog.fetch';
import { configureHttp } from './configure-http';
import {
  emptyStoredCell,
  PRICE_REPOSITORY,
  PriceRepository,
  StoredCell,
} from './prices/price.repository';

describe('API (e2e)', () => {
  let app: INestApplication;
  const getMany = jest.fn<Promise<Map<string, StoredCell>>, [string[]]>();
  const repository: PriceRepository = { getMany };

  beforeAll(async () => {
    process.env.PORT = '3000';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379/0';
    process.env.ITEMS_URL = 'http://catalog.test/items.json';
    process.env.DISCORD_PUBLIC_KEY = 'ab'.repeat(32);
    process.env.FRESH_WITHIN = '30m';
    process.env.CATALOG_REFRESH = '1h';

    const fetchCatalog: CatalogFetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              UniqueName: 'T4_BAG',
              LocalizedNames: {
                'ES-ES': 'Bolsa del iniciado',
                'EN-US': "Adept's Bag",
              },
            },
          ]),
      });

    getMany.mockImplementation((keys: string[]) => {
      const updatedAt = Math.floor(Date.now() / 1000);
      const stored = new Map<string, StoredCell>();
      for (const key of keys) {
        stored.set(key, {
          ...emptyStoredCell(),
          sellMin: 1500,
          sellAmount: 4,
          updatedAt,
          source: 'nats',
        });
      }
      return Promise.resolve(stored);
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CATALOG_FETCH)
      .useValue(fetchCatalog)
      .overrideProvider(PRICE_REPOSITORY)
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    getMany.mockClear();
  });

  it('GET /health returns ok and does not read Redis', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(getMany).not.toHaveBeenCalled();
  });

  it('GET /items/suggest answers without Redis', async () => {
    const response = await request(app.getHttpServer())
      .get('/items/suggest')
      .query({ q: 'bolsa t4.1' })
      .expect(200);

    expect(response.body).toEqual([
      {
        uniqueName: 'T4_BAG@1',
        name: 'Bolsa del iniciado',
        tier: 4,
        enchantment: 1,
      },
    ]);
    expect(getMany).not.toHaveBeenCalled();
  });

  it('GET /prices returns a cell per city', async () => {
    const response = await request(app.getHttpServer())
      .get('/prices')
      .query({ item: 'T4_BAG', locale: 'es' })
      .expect(200);

    expect(response.body.uniqueName).toBe('T4_BAG');
    expect(response.body.name).toBe('Bolsa del iniciado');
    expect(response.body.cells).toHaveLength(8);
    expect(response.body.cells[0].status).toBe('fresh');
    expect(response.body.cells[0].iconUrl).toContain('T4_BAG');
    expect(getMany).toHaveBeenCalledTimes(1);
  });

  it('GET /prices rejects an unknown city with 400', async () => {
    await request(app.getHttpServer())
      .get('/prices')
      .query({ item: 'T4_BAG', cities: 'Atlantis' })
      .expect(400);
  });

  it('GET /prices rejects an empty item with 400', async () => {
    await request(app.getHttpServer())
      .get('/prices')
      .query({ item: '' })
      .expect(400);
  });
});
