import { cellKey } from './cell-key';

describe('cellKey', () => {
  it('writes enchantment 0 as e0', () => {
    expect(
      cellKey({
        uniqueName: 'T4_BAG',
        city: 'Caerleon',
        quality: 1,
        enchantment: 0,
      }),
    ).toBe('west:T4_BAG:Caerleon:q1:e0');
  });

  it('writes enchantment 1 as e1', () => {
    expect(
      cellKey({
        uniqueName: 'T4_BAG',
        city: 'Caerleon',
        quality: 1,
        enchantment: 1,
      }),
    ).toBe('west:T4_BAG:Caerleon:q1:e1');
  });

  it('keeps the space in Black Market', () => {
    expect(
      cellKey({
        uniqueName: 'T4_BAG',
        city: 'Black Market',
        quality: 1,
        enchantment: 0,
      }),
    ).toBe('west:T4_BAG:Black Market:q1:e0');
  });

  it('uses the base name when the id already contains @1', () => {
    expect(
      cellKey({
        uniqueName: 'T4_BAG@1',
        city: 'Caerleon',
        quality: 1,
        enchantment: 0,
      }),
    ).toBe('west:T4_BAG:Caerleon:q1:e0');
  });
});
