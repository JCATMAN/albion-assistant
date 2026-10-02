import { Injectable } from '@nestjs/common';
import { CatalogLocale } from '../catalog/item-name.index';
import { CatalogService, ItemSuggestion } from '../catalog/catalog.service';
import { PriceQuery } from '../prices/price.types';
import { PricesService } from '../prices/prices.service';
import { buildPriceEmbed, DiscordEmbed } from './embed.builder';

const MAXIMUM_CHOICES = 25;

export type InteractionResponse =
  | { type: 1 }
  | {
      type: 8;
      data: { choices: Array<{ name: string; value: string }> };
    }
  | { type: 4; data: { embeds: DiscordEmbed[] } };

interface ParsedOption {
  name: string;
  value?: string | number;
  focused: boolean;
}

interface ParsedInteraction {
  type: number;
  name?: string;
  options: ParsedOption[];
  locale: CatalogLocale;
}

/** Answers Discord pings, item autocomplete, and the price command. */
@Injectable()
export class InteractionHandler {
  constructor(
    private readonly catalog: CatalogService,
    private readonly prices: PricesService,
  ) {}

  async handle(body: unknown): Promise<InteractionResponse> {
    const interaction = parseInteraction(body);
    if (!interaction) {
      return unsupported();
    }
    if (interaction.type === 1) {
      return { type: 1 };
    }
    if (interaction.type === 4) {
      return this.autocomplete(interaction);
    }
    if (interaction.type === 2 && interaction.name === 'price') {
      return this.price(interaction);
    }
    return unsupported();
  }

  private autocomplete(interaction: ParsedInteraction): InteractionResponse {
    const focused = interaction.options.find((option) => option.focused);
    if (
      !focused ||
      focused.name !== 'item' ||
      typeof focused.value !== 'string'
    ) {
      return { type: 8, data: { choices: [] } };
    }
    const suggestions = this.catalog.suggest(focused.value, interaction.locale);
    return {
      type: 8,
      data: {
        choices: suggestions.slice(0, MAXIMUM_CHOICES).map((suggestion) => ({
          name: formatChoiceName(suggestion),
          value: suggestion.uniqueName.slice(0, 100),
        })),
      },
    };
  }

  private async price(
    interaction: ParsedInteraction,
  ): Promise<InteractionResponse> {
    const itemOption = interaction.options.find(
      (option) => option.name === 'item',
    );
    const itemText =
      itemOption && typeof itemOption.value === 'string'
        ? itemOption.value.trim()
        : '';
    if (!itemText || !this.catalog.findByUniqueName(itemText)) {
      return {
        type: 4,
        data: {
          embeds: [
            {
              title: 'Pick a suggestion',
              description:
                'Choose an item from the suggestions. Free text is not looked up.',
            },
          ],
        },
      };
    }

    const query: PriceQuery = {
      item: itemText,
      locale: interaction.locale,
    };
    const city = readStringOption(interaction.options, 'city');
    const quality = readIntegerOption(interaction.options, 'quality', 1, 5);
    const enchantment = readIntegerOption(
      interaction.options,
      'enchantment',
      0,
      4,
    );
    if (city) {
      query.cities = city;
    }
    if (quality !== undefined) {
      query.qualities = String(quality);
    }
    if (enchantment !== undefined) {
      query.enchantment = enchantment;
    }
    const prices = await this.prices.get(query);
    return { type: 4, data: { embeds: [buildPriceEmbed(prices)] } };
  }
}

function formatChoiceName(suggestion: ItemSuggestion): string {
  const label =
    suggestion.tier === null
      ? suggestion.uniqueName
      : suggestion.enchantment > 0
        ? `T${suggestion.tier}.${suggestion.enchantment}`
        : `T${suggestion.tier}`;
  return `${suggestion.name} · ${label}`.slice(0, 100);
}

function unsupported(): InteractionResponse {
  return {
    type: 4,
    data: {
      embeds: [
        {
          title: 'Unsupported interaction',
          description: 'This interaction is not handled.',
        },
      ],
    },
  };
}

function readStringOption(
  options: ParsedOption[],
  name: string,
): string | undefined {
  const option = options.find((entry) => entry.name === name);
  return option && typeof option.value === 'string' ? option.value : undefined;
}

function readIntegerOption(
  options: ParsedOption[],
  name: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const option = options.find((entry) => entry.name === name);
  if (!option) {
    return undefined;
  }
  if (
    typeof option.value === 'number' &&
    Number.isInteger(option.value) &&
    option.value >= minimum &&
    option.value <= maximum
  ) {
    return option.value;
  }
  if (typeof option.value === 'string' && /^\d+$/.test(option.value)) {
    const parsed = Number(option.value);
    if (parsed >= minimum && parsed <= maximum) {
      return parsed;
    }
  }
  return undefined;
}

function parseInteraction(body: unknown): ParsedInteraction | undefined {
  const record = asRecord(body);
  if (!record || typeof record.type !== 'number') {
    return undefined;
  }
  const data = asRecord(record.data);
  const name = data && typeof data.name === 'string' ? data.name : undefined;
  return {
    type: record.type,
    ...(name !== undefined ? { name } : {}),
    options: data ? parseOptions(data.options) : [],
    locale: readLocale(record.locale),
  };
}

function parseOptions(value: unknown): ParsedOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const options: ParsedOption[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (!record || typeof record.name !== 'string') {
      continue;
    }
    const rawValue = record.value;
    const option: ParsedOption = {
      name: record.name,
      focused: record.focused === true,
    };
    if (typeof rawValue === 'string' || typeof rawValue === 'number') {
      option.value = rawValue;
    }
    options.push(option);
  }
  return options;
}

function readLocale(value: unknown): CatalogLocale {
  if (typeof value === 'string' && value.toLowerCase().startsWith('en')) {
    return 'en';
  }
  return 'es';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}
