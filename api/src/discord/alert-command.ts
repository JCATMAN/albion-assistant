import { MARKET_CITIES } from '../catalog/market-cities';
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

/** Slash command that stores a channel watch. The writer sends the later message. */
export const alertCommand: DiscordCommand = {
  name: 'alert',
  name_localizations: { 'es-ES': 'aviso' },
  description: 'Tell me in this channel when a price crosses a target',
  description_localizations: {
    'es-ES': 'Avísame en este canal cuando el precio cruce un objetivo',
  },
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
      name: 'target',
      name_localizations: { 'es-ES': 'precio' },
      description: 'Target silver',
      description_localizations: { 'es-ES': 'Plata objetivo' },
      type: INTEGER_OPTION,
      required: true,
      min_value: 1,
      max_value: 1_000_000_000,
    },
    {
      name: 'city',
      name_localizations: { 'es-ES': 'ciudad' },
      description: 'City. Empty watches every city',
      description_localizations: { 'es-ES': 'Ciudad. Vacío mira todas' },
      type: STRING_OPTION,
      required: false,
      choices: MARKET_CITIES.map((city) => ({ name: city, value: city })),
    },
    {
      name: 'side',
      name_localizations: { 'es-ES': 'lado' },
      description: 'Sell drops to the target, or buy rises to it',
      description_localizations: {
        'es-ES': 'La venta baja al objetivo, o la compra sube',
      },
      type: STRING_OPTION,
      required: false,
      choices: [
        { name: 'Sell', name_localizations: { 'es-ES': 'Venta' }, value: 'sell' },
        { name: 'Buy', name_localizations: { 'es-ES': 'Compra' }, value: 'buy' },
      ],
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
