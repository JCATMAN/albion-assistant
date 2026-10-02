import { MARKET_CITIES } from '../catalog/market-cities';
import { PriceCell, PriceResponse } from '../prices/price.types';

export interface DiscordEmbed {
  title: string;
  description: string;
  thumbnail?: { url: string };
  image?: { url: string };
}

const STATUS_LABEL = {
  fresh: 'Reciente',
  stale: 'Desactualizado',
  missing: 'Sin precio',
} as const;

/** One embed for a price response. Missing cities are omitted only when all eight were asked. */
export function buildPriceEmbed(response: PriceResponse): DiscordEmbed {
  const thumbnailUrl = response.cells[0]?.iconUrl;
  const shown = visibleCells(response);
  const description = response.cells.every((cell) => cell.status === 'missing')
    ? 'No hay precios de mercado para este objeto.'
    : formatTable(shown);
  const embed: DiscordEmbed = {
    title: response.name,
    description: description.slice(0, 4096),
  };
  if (thumbnailUrl) {
    embed.image = { url: thumbnailUrl };
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

function formatTable(cells: PriceCell[]): string {
  const ordered = [...cells].sort(
    (left, right) => sellRank(left) - sellRank(right),
  );
  const bestSell = bestSellPrice(ordered);
  const caption = sharedCaption(ordered);
  const blocks = ordered.map((cell) => formatCity(cell, bestSell));
  return caption ? `${caption}\n\n${blocks.join('\n\n')}` : blocks.join('\n\n');
}

function sharedCaption(cells: PriceCell[]): string | null {
  const first = cells[0];
  if (!first) {
    return null;
  }
  const sameContext = cells.every(
    (cell) =>
      cell.quality === first.quality &&
      cell.enchantment === first.enchantment &&
      cell.status === first.status,
  );
  if (!sameContext) {
    return null;
  }
  return `**${qualityName(first.quality)} · Encantamiento ${first.enchantment} · ${STATUS_LABEL[first.status]}**`;
}

function formatCity(cell: PriceCell, bestSell: number | null): string {
  const best = bestSell !== null && cell.sellMin === bestSell ? ' ✅' : '';
  const lines = [`**${cell.city}**${best}`];
  if (cell.status === 'missing') {
    lines.push('Sin precio');
    return lines.join('\n');
  }
  if (cell.sellMin !== null) {
    lines.push(sideLine('Venta', cell.sellMin, cell.sellAvg, cell.sellAmount));
  }
  if (cell.buyMax !== null) {
    lines.push(sideLine('Compra', cell.buyMax, cell.buyAvg, cell.buyAmount));
  }
  return lines.join('\n');
}

function sideLine(
  title: string,
  price: number,
  average: number | null,
  amount: number | null,
): string {
  const parts = [`**${title}** ${silver(price)}`];
  if (average !== null) {
    parts.push(`**Promedio** ${silver(average)}`);
  }
  if (amount !== null) {
    parts.push(`cantidad ${silver(amount)}`);
  }
  return parts.join(' · ');
}

const QUALITY_NAMES = [
  '',
  'Normal',
  'Buena',
  'Destacada',
  'Excelente',
  'Obra maestra',
] as const;

function qualityName(quality: number): string {
  return QUALITY_NAMES[quality] ?? `Calidad ${quality}`;
}

function sellRank(cell: PriceCell): number {
  return cell.sellMin === null || cell.sellMin <= 0
    ? Number.POSITIVE_INFINITY
    : cell.sellMin;
}

function silver(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
