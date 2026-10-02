import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { CatalogItem } from '../catalog/item-name.index';
import { CatalogService, ItemSuggestion } from '../catalog/catalog.service';
import { PriceResponse } from '../prices/price.types';
import { PricesService } from '../prices/prices.service';
import { InteractionHandler } from './interaction-handler.service';

const bag: CatalogItem = {
  uniqueName: 'T4_BAG',
  tier: 4,
  names: { es: 'Bolsa del iniciado', en: "Adept's Bag" },
};

const suggestion: ItemSuggestion = {
  uniqueName: 'T4_BAG@1',
  name: 'Bolsa del iniciado',
  tier: 4,
  enchantment: 1,
};

const priced: PriceResponse = {
  uniqueName: 'T4_BAG@1',
  name: 'Bolsa del iniciado',
  cells: [
    {
      city: 'Caerleon',
      quality: 1,
      enchantment: 1,
      sellMin: 4978,
      sellAmount: 3,
      sellAvg: null,
      buyMax: 1000,
      buyAmount: null,
      buyAvg: null,
      updatedAt: '2026-06-01T12:00:00.000Z',
      source: 'nats',
      status: 'fresh',
      iconUrl:
        'https://render.albiononline.com/v1/item/T4_BAG@1.png?quality=1&size=100',
    },
  ],
};

describe('InteractionHandler', () => {
  const suggest = jest.fn();
  const findByUniqueName = jest.fn();
  const get = jest.fn();
  let handler: InteractionHandler;

  beforeEach(async () => {
    suggest.mockReset();
    findByUniqueName.mockReset();
    get.mockReset();
    findByUniqueName.mockImplementation((uniqueName: string) =>
      uniqueName === 'T4_BAG' || uniqueName === 'T4_BAG@1' ? bag : undefined,
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        InteractionHandler,
        {
          provide: CatalogService,
          useValue: { suggest, findByUniqueName },
        },
        { provide: PricesService, useValue: { get } },
      ],
    }).compile();
    handler = moduleRef.get(InteractionHandler);
  });

  it('answers a ping', async () => {
    await expect(handler.handle({ type: 1 })).resolves.toEqual({ type: 1 });
    expect(get).not.toHaveBeenCalled();
    expect(suggest).not.toHaveBeenCalled();
  });

  it('autocompletes bolsa t4 without calling prices', async () => {
    suggest.mockReturnValue([suggestion]);

    const response = await handler.handle({
      type: 4,
      data: {
        name: 'price',
        options: [
          { name: 'item', type: 3, value: 'bolsa t4', focused: true },
        ],
      },
    });

    expect(suggest).toHaveBeenCalledWith('bolsa t4', 'es');
    expect(get).not.toHaveBeenCalled();
    expect(response).toEqual({
      type: 8,
      data: {
        choices: [
          { name: 'Bolsa del iniciado · T4.1', value: 'T4_BAG@1' },
        ],
      },
    });
  });

  it('returns at most 25 autocomplete choices', async () => {
    suggest.mockReturnValue(
      Array.from({ length: 30 }, (_unused, index) => ({
        ...suggestion,
        uniqueName: `T4_BAG_${index}`,
        name: `Bag ${index}`,
      })),
    );

    const response = await handler.handle({
      type: 4,
      data: {
        options: [{ name: 'item', value: 'bag', focused: true }],
      },
    });

    expect(response.type).toBe(8);
    if (response.type !== 8) {
      throw new Error('expected autocomplete');
    }
    expect(response.data.choices).toHaveLength(25);
    expect(get).not.toHaveBeenCalled();
  });

  it('returns a price embed for a known unique name', async () => {
    get.mockResolvedValue(priced);

    const response = await handler.handle({
      type: 2,
      data: {
        name: 'price',
        options: [{ name: 'item', type: 3, value: 'T4_BAG@1' }],
      },
    });

    expect(get).toHaveBeenCalledWith({ item: 'T4_BAG@1', locale: 'es' });
    expect(response.type).toBe(4);
    if (response.type !== 4) {
      throw new Error('expected a message');
    }
    expect(response.data.embeds[0]?.author?.icon_url).toContain('T4_BAG@1');
    expect(response.data.embeds[0]?.description).toContain('4978');
  });

  it('asks for a suggestion when the item text is not a unique name', async () => {
    const response = await handler.handle({
      type: 2,
      data: {
        name: 'price',
        options: [{ name: 'item', type: 3, value: 'bolsa t4' }],
      },
    });

    expect(get).not.toHaveBeenCalled();
    expect(suggest).not.toHaveBeenCalled();
    expect(response.type).toBe(4);
    if (response.type !== 4) {
      throw new Error('expected a message');
    }
    expect(response.data.embeds[0]?.title).toBe('Pick a suggestion');
  });
});
