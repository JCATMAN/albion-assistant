import { MARKET_CITIES } from '../catalog/market-cities';
import { PriceCell, PriceResponse } from '../prices/price.types';
import { buildPriceEmbed } from './embed.builder';

function cell(overrides: Partial<PriceCell> & Pick<PriceCell, 'city' | 'status'>): PriceCell {
  return {
    quality: 1,
    enchantment: 1,
    sellMin: null,
    sellAmount: null,
    sellAvg: null,
    buyMax: null,
    buyAmount: null,
    buyAvg: null,
    updatedAt: null,
    source: null,
    iconUrl:
      'https://render.albiononline.com/v1/item/T4_BAG@1.png?quality=1&size=100',
    ...overrides,
  };
}

describe('buildPriceEmbed', () => {
  it('includes prices and the thumbnail for a fresh cell', () => {
    const response: PriceResponse = {
      uniqueName: 'T4_BAG@1',
      name: 'Bolsa del iniciado',
      cells: [
        cell({
          city: 'Caerleon',
          status: 'fresh',
          sellMin: 4978,
          sellAmount: 12,
          buyMax: 3200,
          updatedAt: '2026-06-01T11:59:00.000Z',
          source: 'nats',
        }),
      ],
    };

    const embed = buildPriceEmbed(response);

    expect(embed.author?.name).toBe('Bolsa del iniciado');
    expect(embed.description).toContain('4978');
    expect(embed.description).toContain('3200');
    expect(embed.description).toContain('sell amount 12');
    expect(embed.author?.icon_url).toBe(response.cells[0]?.iconUrl);
  });

  it('does not invent a zero when every cell is missing', () => {
    const response: PriceResponse = {
      uniqueName: 'T4_BAG',
      name: 'Bolsa del iniciado',
      cells: [cell({ city: 'Caerleon', status: 'missing', enchantment: 0 })],
    };

    const embed = buildPriceEmbed(response);

    expect(embed.description).toBe(
      'No market prices are available for this item.',
    );
    expect(embed.description).not.toContain('0');
    expect(embed.author?.icon_url).toBe(response.cells[0]?.iconUrl);
  });

  it('omits missing lines when all eight cities were requested and some have data', () => {
    const cells = MARKET_CITIES.map((city) =>
      cell({
        city,
        status: city === 'Caerleon' ? 'fresh' : 'missing',
        sellMin: city === 'Caerleon' ? 4978 : null,
        enchantment: 0,
      }),
    );
    const embed = buildPriceEmbed({
      uniqueName: 'T4_BAG',
      name: 'Bolsa del iniciado',
      cells,
    });

    expect(embed.description).toContain('Caerleon');
    expect(embed.description).toContain('4978');
    expect(embed.description).not.toContain('Thetford');
    expect(embed.description).not.toContain('missing');
  });

  it('keeps a missing line when the query did not ask for every city', () => {
    const embed = buildPriceEmbed({
      uniqueName: 'T4_BAG',
      name: 'Bolsa del iniciado',
      cells: [
        cell({ city: 'Caerleon', status: 'fresh', sellMin: 10, enchantment: 0 }),
        cell({ city: 'Martlock', status: 'missing', enchantment: 0 }),
      ],
    });

    expect(embed.description).toContain('Martlock');
    expect(embed.description).toContain('missing');
  });
});
