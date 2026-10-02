import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureHttp } from '../configure-http';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

describe('PricesController', () => {
  let app: INestApplication;
  const get = jest.fn().mockResolvedValue({
    uniqueName: 'T4_BAG',
    name: 'Bolsa del iniciado',
    cells: [],
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PricesController],
      providers: [{ provide: PricesService, useValue: { get } }],
    }).compile();
    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an empty item with 400', async () => {
    await request(app.getHttpServer())
      .get('/prices')
      .query({ item: '' })
      .expect(400);
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects a missing item with 400', async () => {
    await request(app.getHttpServer()).get('/prices').expect(400);
  });

  it('delegates a valid query to the service', async () => {
    await request(app.getHttpServer())
      .get('/prices')
      .query({ item: 'T4_BAG', cities: 'Caerleon' })
      .expect(200);
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ item: 'T4_BAG', cities: 'Caerleon' }),
    );
  });
});
