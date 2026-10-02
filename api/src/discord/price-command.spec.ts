import { MARKET_CITIES } from '../catalog/market-cities';
import { priceCommand } from './price-command';

describe('priceCommand', () => {
  it('keeps the English command name and a lowercase Spanish localization', () => {
    expect(priceCommand.name).toBe('price');
    expect(priceCommand.name_localizations['es-ES']).toBe('precio');
    expect(priceCommand.description_localizations['es-ES']).toBe('Precio');
  });

  it('offers item, city, quality, and enchantment', () => {
    expect(priceCommand.options.map((option) => option.name)).toEqual([
      'item',
      'city',
      'quality',
      'enchantment',
    ]);
  });

  it('autocompletes only the item option', () => {
    const item = priceCommand.options.find((option) => option.name === 'item');
    expect(item?.type).toBe(3);
    expect(item?.required).toBe(true);
    expect(item?.autocomplete).toBe(true);
    expect(item?.name_localizations['es-ES']).toBe('objeto');
    expect(item?.description_localizations['es-ES']).toBe('Objeto');
  });

  it('lists the eight cities', () => {
    const city = priceCommand.options.find((option) => option.name === 'city');
    expect(city?.required).toBe(false);
    expect(city?.name_localizations['es-ES']).toBe('ciudad');
    expect(city?.description_localizations['es-ES']).toBe('Ciudad');
    expect(city?.choices?.map((choice) => choice.value)).toEqual([
      ...MARKET_CITIES,
    ]);
  });

  it('lists qualities 1 through 5', () => {
    const quality = priceCommand.options.find(
      (option) => option.name === 'quality',
    );
    expect(quality?.type).toBe(4);
    expect(quality?.name_localizations['es-ES']).toBe('calidad');
    expect(quality?.description_localizations['es-ES']).toBe('Calidad');
    expect(quality?.choices?.map((choice) => choice.value)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(quality?.choices?.map((choice) => choice.name)).toEqual([
      'Normal',
      'Good',
      'Outstanding',
      'Excellent',
      'Masterpiece',
    ]);
    expect(
      quality?.choices?.map((choice) => choice.name_localizations?.['es-ES']),
    ).toEqual(['Normal', 'Buena', 'Destacada', 'Excelente', 'Obra maestra']);
  });

  it('lists enchantments 0 through 4', () => {
    const enchantment = priceCommand.options.find(
      (option) => option.name === 'enchantment',
    );
    expect(enchantment?.type).toBe(4);
    expect(enchantment?.name_localizations['es-ES']).toBe('encantamiento');
    expect(enchantment?.description_localizations['es-ES']).toBe(
      'Encantamiento',
    );
    expect(enchantment?.choices?.map((choice) => choice.value)).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });
});
