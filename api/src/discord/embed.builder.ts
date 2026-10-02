import { MARKET_CITIES } from '../catalog/market-cities';
import { PriceCell, PriceResponse } from '../prices/price.types';

export interface DiscordEmbed {
  title: string;
  description: string;
  thumbnail?: { url: string };
}

/** One embed for a price response. Missing cities are omitted only when all eight were asked. */
export function buildPriceEmbed(response: PriceResponse): DiscordEmbed {
  const thumbnailUrl = response.cells[0]?.iconUrl;
  const description = response.cells.every((cell) => cell.status === 'missing')
    ? 'No market prices are available for this item.'
    : visibleCells(response).map(formatCellLine).join('\n');
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

function formatCellLine(cell: PriceCell): string {
  const parts = [
    `${cell.city} · q${cell.quality} · e${cell.enchantment} · ${cell.status}`,
  ];
  if (cell.status === 'missing') {
    return parts[0] ?? cell.city;
  }
  if (cell.sellMin !== null) {
    parts.push(`sell ${cell.sellMin}`);
  }
  if (cell.sellAmount !== null) {
    parts.push(`sell amount ${cell.sellAmount}`);
  }
  if (cell.sellAvg !== null) {
    parts.push(`sell avg ${cell.sellAvg}`);
  }
  if (cell.buyMax !== null) {
    parts.push(`buy ${cell.buyMax}`);
  }
  if (cell.buyAmount !== null) {
    parts.push(`buy amount ${cell.buyAmount}`);
  }
  if (cell.buyAvg !== null) {
    parts.push(`buy avg ${cell.buyAvg}`);
  }
  return parts.join(' · ');
}
