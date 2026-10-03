import { ArbitrageRoute } from '../prices/arbitrage';
import { DiscordEmbed } from './embed.builder';

const QUALITY_NAMES = [
  '',
  'Normal',
  'Buena',
  'Destacada',
  'Excelente',
  'Obra maestra',
] as const;

/** One embed for an instant buy-low sell-high route. */
export function buildArbitrageEmbed(input: {
  name: string;
  iconUrl?: string;
  quality: number;
  enchantment: number;
  route: ArbitrageRoute | null;
}): DiscordEmbed {
  const quality = QUALITY_NAMES[input.quality] ?? `Calidad ${input.quality}`;
  const embed: DiscordEmbed = {
    title: input.name,
    description: input.route
      ? routeDescription(input.route, quality, input.enchantment)
      : `**${quality} · Encantamiento ${input.enchantment}**\nNo hay ruta. Ninguna compra en otra ciudad supera la venta más barata.`,
  };
  if (input.iconUrl) {
    embed.thumbnail = { url: input.iconUrl };
  }
  return embed;
}

function routeDescription(
  route: ArbitrageRoute,
  quality: string,
  enchantment: number,
): string {
  const status = route.fresh ? 'Reciente' : 'Desactualizado';
  const rows = [
    ['Comprar en ' + route.buyCity, silver(route.buyPrice)],
    ['Vender en ' + route.sellCity, silver(route.sellPrice)],
    ['Margen', silver(route.margin)],
  ];
  const labelWidth = Math.max(...rows.map((row) => row[0].length));
  const table = rows
    .map((row) => `${row[0].padEnd(labelWidth)}  ${row[1]}`)
    .join('\n');
  return `**${quality} · Encantamiento ${enchantment} · ${status}**\n\`\`\`\n${table}\n\`\`\``;
}

function silver(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
