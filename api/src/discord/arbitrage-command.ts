import { DiscordCommand, DiscordCommandChoice } from './price-command';

const STRING_OPTION = 3;
const INTEGER_OPTION = 4;

const QUALITIES: DiscordCommandChoice[] = [
  { name: 'Normal', name_localizations: { 'es-ES': 'Normal' }, value: 1 },
  { name: 'Good', name_localizations: { 'es-ES': 'Buena' }, value: 2 },
  { name: 'Outstanding', name_localizations: { 'es-ES': 'Destacada' }, value: 3 },
  { name: 'Excellent', name_localizations: { 'es-ES': 'Excelente' }, value: 4 },
  { name: 'Masterpiece', name_localizations: { 'es-ES': 'Obra maestra' }, value: 5 },
];

/** Slash command for an instant buy-low sell-high route. City is chosen by the route. */
export const arbitrageCommand: DiscordCommand = {
  name: 'arbitrage',
  name_localizations: { 'es-ES': 'arbitraje' },
  description: 'Find where to buy low and sell high',
  description_localizations: { 'es-ES': 'Dónde comprar barato y vender caro' },
  options: [
    {
      name: 'item',
      name_localizations: { 'es-ES': 'objeto' },
      description: 'Item',
      description_localizations: { 'es-ES': 'Objeto' },
      type: STRING_OPTION,
      required: true,
      autocomplete: true,
    },
    {
      name: 'quality',
      name_localizations: { 'es-ES': 'calidad' },
      description: 'Quality',
      description_localizations: { 'es-ES': 'Calidad' },
      type: INTEGER_OPTION,
      required: false,
      choices: QUALITIES,
    },
    {
      name: 'enchantment',
      name_localizations: { 'es-ES': 'encantamiento' },
      description: 'Enchantment',
      description_localizations: { 'es-ES': 'Encantamiento' },
      type: INTEGER_OPTION,
      required: false,
      choices: [0, 1, 2, 3, 4].map((enchantment) => ({
        name: String(enchantment),
        value: enchantment,
      })),
    },
  ],
};
