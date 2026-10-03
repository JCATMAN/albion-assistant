import { buildArbitrageEmbed } from './arbitrage.embed';

describe('buildArbitrageEmbed', () => {
  it('shows the buy city, the sell city, and the margin', () => {
    const embed = buildArbitrageEmbed({
      name: 'Bolsa del experto',
      quality: 1,
      enchantment: 0,
      iconUrl: 'https://render.albiononline.com/v1/item/T5_BAG.png?quality=1&size=100',
      route: {
        buyCity: 'Martlock',
        buyPrice: 12855,
        sellCity: 'Caerleon',
        sellPrice: 15133,
        margin: 2278,
        fresh: true,
      },
    });

    expect(embed.title).toBe('Bolsa del experto');
    expect(embed.description).toContain('**Normal · Encantamiento 0 · Reciente**');
    expect(embed.description).toContain('Comprar en Martlock');
    expect(embed.description).toContain('12.855');
    expect(embed.description).toContain('Vender en Caerleon');
    expect(embed.description).toContain('15.133');
    expect(embed.description).toContain('Margen');
    expect(embed.description).toContain('2.278');
    expect(embed.thumbnail?.url).toContain('T5_BAG');
  });

  it('says there is no route without inventing a margin', () => {
    const embed = buildArbitrageEmbed({
      name: 'Bolsa del experto',
      quality: 1,
      enchantment: 0,
      route: null,
    });

    expect(embed.description).toContain('No hay ruta');
    expect(embed.description).not.toContain('Margen');
  });
});