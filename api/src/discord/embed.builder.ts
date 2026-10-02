import { MARKET_CITIES } from '../catalog/market-cities';
import { PriceCell, PriceResponse } from '../prices/price.types';

export interface DiscordEmbed {
  title: string;
  description: string;
  thumbnail?: { url: string };
}

const STATUS_LABEL = {
  fresh: 'Fresco',
  stale: 'Desactualizado',
  missing: 'Sin precio',
} as const;


/** One embed for a price response. Missing cities are omitted only when all eight were asked. */
export function buildPriceEmbed(response: PriceResponse): DiscordEmbed {
  const thumbnailUrl = response.cells[0]?.iconUrl;
  const shown = visibleCells(response);
  const description = response.cells.every((cell) => cell.status === 'missing')
    ? 'No hay precios de mercado para este objeto.'
    : shown.map((cell) => formatCityBlock(cell, bestSellPrice(shown))).join('\n\n');
  const embed: DiscordEmbed = {
    title: response.name,
    description: description.slice(0, 4096),
  };
  if (thumbnailUrl) {
    embed.thumbnail = { url: thumbnailUrl };
  }
  return embed;
}

function visibleCells(response: PriceResponse): PriceCell[] {
  const cities = new Set(response.cells.map((cell) => cell.city));
  const requestedAllCities = MARKET_CITIES.every((city) => cities.has(city));
  const anyPriced = response.cells.some((cell) => cell.status !== 'missing');
  if (requestedAllCities && anyPriced) {
    return response.cells.filter((cell) => cell.status !== 'missing');
  }
  return response.cells;
}

function bestSellPrice(cells: PriceCell[]): number | null {
  const prices = cells
    .map((cell) => cell.sellMin)
    .filter((price): price is number => price !== null && price > 0);
  if (prices.length === 0) {
    return null;
  }
  return Math.min(...prices);
}

function formatCityBlock(cell: PriceCell, bestSell: number | null): string {
  const bestMark =
    bestSell !== null && cell.sellMin === bestSell ? ' ✅' : '';
  const lines = [
    `**${cell.city}**${bestMark}`,
    `Calidad ${cell.quality} · Encantamiento ${cell.enchantment} · ${STATUS_LABEL[cell.status]}`,
  ];
  if (cell.status === 'missing') {
    return lines.join('\n');
  }
  if (cell.sellMin !== null) {
    lines.push(priceLine('Venta', cell.sellMin, cell.sellAvg, cell.sellAmount));
  }
  if (cell.buyMax !== null) {
    lines.push(priceLine('Compra', cell.buyMax, cell.buyAvg, cell.buyAmount));
  }
  return lines.join('\n');
}

function priceLine(
  title: string,
  price: number,
  average: number | null,
  amount: number | null,
): string {
  const parts = [`**${title}** ${silver(price)}`];
  if (average !== null) {
    parts.push(`promedio ${silver(average)}`);
  }
  if (amount !== null) {
    parts.push(`cantidad ${silver(amount)}`);
  }
  return parts.join(' · ');
}

function silver(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
