import { PriceCell } from './price.types';

export interface ArbitrageRoute {
  buyCity: string;
  buyPrice: number;
  sellCity: string;
  sellPrice: number;
  margin: number;
  fresh: boolean;
}

/** Best instant route: pay a city's sell price, collect another city's buy order. */
export function findArbitrage(cells: PriceCell[]): ArbitrageRoute | null {
  let best: ArbitrageRoute | null = null;
  for (const origin of cells) {
    if (origin.sellMin === null || origin.sellMin <= 0) {
      continue;
    }
    for (const destination of cells) {
      if (origin.city === destination.city) {
        continue;
      }
      if (destination.buyMax === null || destination.buyMax <= 0) {
        continue;
      }
      const margin = destination.buyMax - origin.sellMin;
      if (margin <= 0) {
        continue;
      }
      const candidate: ArbitrageRoute = {
        buyCity: origin.city,
        buyPrice: origin.sellMin,
        sellCity: destination.city,
        sellPrice: destination.buyMax,
        margin,
        fresh: origin.status === 'fresh' && destination.status === 'fresh',
      };
      if (best === null || isBetterRoute(candidate, best)) {
        best = candidate;
      }
    }
  }
  return best;
}

function isBetterRoute(candidate: ArbitrageRoute, current: ArbitrageRoute): boolean {
  if (candidate.margin !== current.margin) {
    return candidate.margin > current.margin;
  }
  if (candidate.buyCity !== current.buyCity) {
    return candidate.buyCity < current.buyCity;
  }
  return candidate.sellCity < current.sellCity;
}
