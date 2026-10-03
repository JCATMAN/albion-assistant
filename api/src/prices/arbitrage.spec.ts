import { PriceCell } from './price.types';
import { findArbitrage } from './arbitrage';

function cell(
  city: string,
  sellMin: number | null,
  buyMax: number | null,
  status: PriceCell['status'] = 'fresh',
): PriceCell {
  return {
    city,
    quality: 1,
    enchantment: 0,
    sellMin,
    sellAmount: null,
    sellAvg: sellMin,
    buyMax,
    buyAmount: null,
    buyAvg: buyMax,
    updatedAt: null,
    source: 'nats',
    status,
    iconUrl: 'https://render.albiononline.com/v1/item/T4_BAG.png?quality=1&size=100',
  };
}

describe('findArbitrage', () => {
  it('sells into the best buy order, even when that city also has the cheapest listing', () => {
    const route = findArbitrage([
      cell('Martlock', 5, 1000),
      cell('Lymhurst', 10, 30),
      cell('Caerleon', 100, 40),
    ]);

    expect(route).toEqual({
      buyCity: 'Lymhurst',
      buyPrice: 10,
      sellCity: 'Martlock',
      sellPrice: 1000,
      margin: 990,
      fresh: true,
    });
  });

  it('returns nothing when no other city pays more than the listing', () => {
    expect(
      findArbitrage([
        cell('Martlock', 100, 40),
        cell('Caerleon', 90, 50),
      ]),
    ).toBeNull();
  });

  it('marks the route stale when either leg is stale', () => {
    const route = findArbitrage([
      cell('Martlock', 100, null),
      cell('Caerleon', 200, 150, 'stale'),
    ]);

    expect(route?.fresh).toBe(false);
    expect(route?.margin).toBe(50);
  });
});
