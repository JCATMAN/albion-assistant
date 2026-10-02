import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureHttp } from '../configure-http';
import { CatalogModule } from './catalog.module';
import { CatalogService } from './catalog.service';
import { ItemsController } from './items.controller';

describe('ItemsController', () => {
  let app: INestApplication;
  const suggest = jest.fn().mockReturnValue([]);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [{ provide: CatalogService, useValue: { suggest } }],
    }).compile();
    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a missing q with 400', async () => {
    await request(app.getHttpServer()).get('/items/suggest').expect(400);
    expect(suggest).not.toHaveBeenCalled();
  });

  it('does not depend on Redis', () => {
    const parameters = Reflect.getMetadata(
      'design:paramtypes',
      ItemsController,
    ) as Array<{ name: string }>;
    expect(parameters.map((parameter) => parameter.name)).toEqual([
      'CatalogService',
    ]);
    const imports = Reflect.getMetadata('imports', CatalogModule) as
      | Array<{ name?: string }>
      | undefined;
    const names = (imports ?? []).map((entry) => entry.name);
    expect(names).not.toContain('PricesModule');
  });

  it('delegates a valid query to the catalog', async () => {
    await request(app.getHttpServer())
      .get('/items/suggest')
      .query({ q: 'bolsa', locale: 'es' })
      .expect(200);
    expect(suggest).toHaveBeenCalledWith('bolsa', 'es');
  });
});
