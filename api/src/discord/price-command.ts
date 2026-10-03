import { MARKET_CITIES } from '../catalog/market-cities';

const STRING_OPTION = 3;
export interface DiscordCommandChoice {
  name: string;
  name_localizations?: { 'es-ES': string };
  value: string | number;
}

export interface DiscordCommandOption {
  name: string;
  name_localizations: { 'es-ES': string };
  description: string;
  description_localizations: { 'es-ES': string };
  type: number;
  required: boolean;
  autocomplete?: boolean;
  choices?: DiscordCommandChoice[];
}

export interface DiscordCommand {
  name: string;
  name_localizations: { 'es-ES': string };
  description: string;
  description_localizations: { 'es-ES': string };
  options: DiscordCommandOption[];
}

/** Slash command registered by the manual script. Names stay English; es-ES is lowercase. */
export const priceCommand: DiscordCommand = {
  name: 'price',
  name_localizations: { 'es-ES': 'precio' },
  description: 'Show the market price of an item',
  description_localizations: { 'es-ES': 'Precio' },
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
      name: 'city',
      name_localizations: { 'es-ES': 'ciudad' },
      description: 'City',
      description_localizations: { 'es-ES': 'Ciudad' },
      type: STRING_OPTION,
      required: false,
      choices: MARKET_CITIES.map((city) => ({ name: city, value: city })),
    },
  ],
};
