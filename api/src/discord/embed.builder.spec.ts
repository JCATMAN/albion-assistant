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
          sellAvg: 4978,
          buyMax: 3200,
          buyAvg: 3200,
          updatedAt: '2026-06-01T11:59:00.000Z',
          source: 'nats',
        }),
      ],
    };

    const embed = buildPriceEmbed(response);

    expect(embed.title).toBe('Bolsa del iniciado');
    expect(embed.description).toContain('**Normal · Encantamiento 1 · Reciente**');
    expect(embed.description).toContain('```');
    expect(embed.description).toContain('Caerleon ✅');
    expect(embed.description).toContain('Venta/Promedio');
    expect(embed.description).toContain('4.978/4.978 x12');
    expect(embed.description).toContain('3.200/3.200');
    expect(embed.description).not.toContain('sell');
    expect(embed.description).not.toContain('buy');
    expect(embed.thumbnail?.url).toBe(response.cells[0]?.iconUrl);
  });

  it('does not invent a zero when every cell is missing', () => {
    const response: PriceResponse = {
      uniqueName: 'T4_BAG',
      name: 'Bolsa del iniciado',
      cells: [cell({ city: 'Caerleon', status: 'missing', enchantment: 0 })],
    };

    const embed = buildPriceEmbed(response);

    expect(embed.description).toBe(
      'No hay precios de mercado para este objeto.',
    );
    expect(embed.description).not.toContain('0');
    expect(embed.thumbnail?.url).toBe(response.cells[0]?.iconUrl);
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
    expect(embed.description).toContain('4.978');
    expect(embed.description).not.toContain('Thetford');
    expect(embed.description).not.toContain('Sin precio');
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
    expect(embed.description).toContain('Sin precio');
    expect(embed.description).toContain('Caerleon ✅');
  });

  it('marks only the cheapest sell price', () => {
    const embed = buildPriceEmbed({
      uniqueName: 'T4_BAG',
      name: 'Bolsa del iniciado',
      cells: [
        cell({ city: 'Thetford', status: 'fresh', sellMin: 3500, enchantment: 0 }),
        cell({ city: 'Brecilien', status: 'fresh', sellMin: 3424, enchantment: 0 }),
      ],
    });

    expect(embed.description).toContain('Brecilien ✅');
    expect(embed.description).not.toContain('Thetford ✅');
    expect(embed.description.indexOf('Brecilien')).toBeLessThan(
      embed.description.indexOf('Thetford'),
    );
  });
});
