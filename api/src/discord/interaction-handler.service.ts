import { Injectable, Logger } from '@nestjs/common';
import { CatalogLocale } from '../catalog/item-name.index';
import { CatalogService, ItemSuggestion } from '../catalog/catalog.service';
import { PriceQuery } from '../prices/price.types';
import { PricesService } from '../prices/prices.service';
import { discordCallback } from './discord-defer';
import { buildPriceEmbed, DiscordEmbed } from './embed.builder';
import {
  buildPriceButtons,
  decodePriceButton,
  DiscordActionRow,
} from './price-buttons';

const MAXIMUM_CHOICES = 25;

export type InteractionResponse =
  | { type: 1 }
  | { type: 5 | 6 }
  | {
      type: 8;
      data: { choices: Array<{ name: string; value: string }> };
    }
  | {
      type: 4 | 7;
      data: { embeds: DiscordEmbed[]; components?: DiscordActionRow[] };
    };

interface ParsedOption {
  name: string;
  value?: string | number;
  focused: boolean;
}

interface ParsedInteraction {
  type: number;
  name?: string;
  customId?: string;
  options: ParsedOption[];
  locale: CatalogLocale;
}

/** Answers Discord pings, item autocomplete, and the price command. */
@Injectable()
export class InteractionHandler {
  private readonly logger = new Logger(InteractionHandler.name);

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
    if (interaction.type === 3 && interaction.customId) {
      return this.button(interaction.customId, interaction.locale);
    }
    return unsupported();
  }

  /** Edits the deferred Discord message after the price lookup finishes. */
  async completeDeferred(body: unknown): Promise<void> {
    const callback = discordCallback(body);
    if (!callback) {
      this.logger.error('deferred interaction is missing application_id or token');
      return;
    }
    try {
      const response = await this.handle(body);
      if (response.type !== 4 && response.type !== 7) {
        return;
      }
      const edit = await fetch(
        `https://discord.com/api/v10/webhooks/${callback.applicationId}/${callback.token}/messages/@original`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response.data),
        },
      );
      if (!edit.ok) {
        this.logger.error(
          `discord edit failed with HTTP ${edit.status}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`deferred price reply failed: ${message}`);
    }
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

    const city = readStringOption(interaction.options, 'city');
    const chosenQuality = readIntegerOption(interaction.options, 'quality', 1, 5);
    const chosenEnchantment = readIntegerOption(
      interaction.options,
      'enchantment',
      0,
      4,
    );
    return {
      type: 4,
      data: await this.priceMessage({
        item: itemText,
        quality: chosenQuality ?? 1,
        enchantment: chosenEnchantment ?? enchantmentFromItem(itemText),
        showButtons: chosenQuality === undefined && chosenEnchantment === undefined,
        locale: interaction.locale,
        ...(city ? { city } : {}),
      }),
    };
  }

  private async button(
    customId: string,
    locale: CatalogLocale,
  ): Promise<InteractionResponse> {
    const state = decodePriceButton(customId);
    if (!state) {
      return unsupported();
    }
    return {
      type: 7,
      data: await this.priceMessage({ ...state, locale, showButtons: true }),
    };
  }

  private async priceMessage(input: {
    item: string;
    quality: number;
    enchantment: number;
    locale: CatalogLocale;
    showButtons: boolean;
    city?: string;
  }): Promise<{ embeds: DiscordEmbed[]; components?: DiscordActionRow[] }> {
    const query: PriceQuery = {
      item: input.item,
      locale: input.locale,
      qualities: String(input.quality),
      enchantment: input.enchantment,
    };
    if (input.city) {
      query.cities = input.city;
    }
    const prices = await this.prices.get(query);
    const message: { embeds: DiscordEmbed[]; components?: DiscordActionRow[] } = {
      embeds: [buildPriceEmbed(prices)],
    };
    if (input.showButtons) {
      message.components = buildPriceButtons({
        item: input.item,
        quality: input.quality,
        enchantment: input.enchantment,
        ...(input.city ? { city: input.city } : {}),
      });
    }
    return message;
  }
}

function enchantmentFromItem(item: string): number {
  const match = /@([0-4])$/.exec(item);
  return match?.[1] ? Number(match[1]) : 0;
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
  const customId =
    data && typeof data.custom_id === 'string' ? data.custom_id : undefined;
  return {
    type: record.type,
    ...(name !== undefined ? { name } : {}),
    ...(customId !== undefined ? { customId } : {}),
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
