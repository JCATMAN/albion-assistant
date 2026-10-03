import { MARKET_CITIES } from '../catalog/market-cities';
import { PriceCell, PriceResponse } from '../prices/price.types';

export interface DiscordEmbed {
  title: string;
  description: string;
  thumbnail?: { url: string };
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

function formatTable(cells: PriceCell[]): string {
  const ordered = [...cells].sort(
    (left, right) => sellRank(left) - sellRank(right),
  );
  const bestSell = bestSellPrice(ordered);
  const caption = sharedCaption(ordered);
  const cityHeader = 'Ciudad';
  const sellHeader = 'Venta';
  const buyHeader = 'Compra';
  const cityLabels = ordered.map((cell) => cityLabel(cell, bestSell));
  const sellLabels = ordered.map((cell) =>
    cell.status === 'missing'
      ? 'Sin precio'
      : sideLabel(cell.sellMin, cell.sellAmount),
  );
  const buyLabels = ordered.map((cell) => sideLabel(cell.buyMax, cell.buyAmount));
  const cityWidth = Math.max(
    displayWidth(cityHeader),
    ...cityLabels.map(displayWidth),
  );
  const sellWidth = Math.max(
    sellHeader.length,
    ...sellLabels.map((label) => label.length),
  );
  const lines = [
    `${padRight(cityHeader, cityWidth)}  ${padLeft(sellHeader, sellWidth)}  ${buyHeader}`,
    ...ordered.map((_cell, index) => {
      const city = cityLabels[index] ?? '';
      const sell = sellLabels[index] ?? '—';
      const buy = buyLabels[index] ?? '—';
      return `${padRight(city, cityWidth)}  ${padLeft(sell, sellWidth)}  ${buy}`;
    }),
  ];
  const table = ['```', ...lines, '```'].join('\n');
  return caption ? `${caption}\n${table}` : table;
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

function cityLabel(cell: PriceCell, bestSell: number | null): string {
  const best = bestSell !== null && cell.sellMin === bestSell ? ' ✅' : '';
  return `${cell.city}${best}`;
}

function sideLabel(price: number | null, amount: number | null): string {
  if (price === null) {
    return '—';
  }
  if (amount === null) {
    return silver(price);
  }
  return `${silver(price)} x${silver(amount)}`;
}

function displayWidth(text: string): number {
  const checks = text.match(/✅/g)?.length ?? 0;
  return [...text].length + checks;
}

function padRight(text: string, width: number): string {
  return text + ' '.repeat(Math.max(width - displayWidth(text), 0));
}

function padLeft(text: string, width: number): string {
  return ' '.repeat(Math.max(width - text.length, 0)) + text;
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
