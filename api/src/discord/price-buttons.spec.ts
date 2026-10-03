import { buildPriceButtons, decodePriceButton } from './price-buttons';

describe('price buttons', () => {
  it('marks the active quality and enchantment', () => {
    const rows = buildPriceButtons({
      item: 'T5_BAG',
      quality: 1,
      enchantment: 0,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.components.map((button) => button.label)).toEqual([
      'Normal',
      'Buena',
      'Destacada',
      'Excelente',
      'Obra maestra',
    ]);
    expect(rows[0]?.components[0]?.style).toBe(1);
    expect(rows[0]?.components[1]?.style).toBe(2);
    expect(rows[1]?.components[0]?.style).toBe(1);
    expect(rows[1]?.components[2]?.custom_id).toBe('p:1:2:_:T5_BAG');
  });

  it('keeps a city name that contains a space', () => {
    const rows = buildPriceButtons({
      item: 'T4_BAG',
      quality: 4,
      enchantment: 1,
      city: 'Fort Sterling',
    });
    const decoded = decodePriceButton(rows[0]?.components[3]?.custom_id ?? '');

    expect(decoded).toEqual({
      item: 'T4_BAG',
      quality: 4,
      enchantment: 1,
      city: 'Fort Sterling',
    });
  });

  it('rejects an unknown button id', () => {
    expect(decodePriceButton('other')).toBeUndefined();
  });
});
