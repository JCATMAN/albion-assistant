export interface PriceButtonState {
  item: string;
  quality: number;
  enchantment: number;
  city?: string;
}

export interface DiscordButton {
  type: 2;
  style: 1 | 2;
  label: string;
  custom_id: string;
}

export interface DiscordActionRow {
  type: 1;
  components: DiscordButton[];
}

const QUALITY_LABELS = [
  '',
  'Normal',
  'Buena',
  'Destacada',
  'Excelente',
  'Obra maestra',
] as const;

/** Two rows: quality, then enchantment. The active value uses the primary style. */
export function buildPriceButtons(
  state: PriceButtonState,
  family: 'p' | 'a' = 'p',
): DiscordActionRow[] {
  return [
    {
      type: 1,
      components: [1, 2, 3, 4, 5].map((quality) =>
        button(
          QUALITY_LABELS[quality] ?? String(quality),
          quality === state.quality,
          { ...state, quality },
          'q',
          family,
        ),
      ),
    },
    {
      type: 1,
      components: [0, 1, 2, 3, 4].map((enchantment) =>
        button(
          `.${enchantment}`,
          enchantment === state.enchantment,
          { ...state, enchantment },
          'e',
          family,
        ),
      ),
    },
  ];
}

/** Reads a price button id. Returns undefined when the id is not one of ours. */
export function decodePriceButton(customId: string): PriceButtonState | undefined {
  const parts = customId.split(':');
  if (
    parts.length !== 5 ||
    (parts[0] !== 'pq' && parts[0] !== 'pe' && parts[0] !== 'aq' && parts[0] !== 'ae')
  ) {
    return undefined;
  }
  const quality = Number(parts[1]);
  const enchantment = Number(parts[2]);
  const cityToken = parts[3];
  const item = parts[4];
  if (
    !item ||
    !Number.isInteger(quality) ||
    quality < 1 ||
    quality > 5 ||
    !Number.isInteger(enchantment) ||
    enchantment < 0 ||
    enchantment > 4 ||
    cityToken === undefined
  ) {
    return undefined;
  }
  return {
    item,
    quality,
    enchantment,
    ...(cityToken === '_' ? {} : { city: cityToken }),
  };
}

function button(
  label: string,
  selected: boolean,
  state: PriceButtonState,
  kind: 'q' | 'e',
  family: 'p' | 'a',
): DiscordButton {
  return {
    type: 2,
    style: selected ? 1 : 2,
    label,
    custom_id: encodePriceButton(state, kind, family),
  };
}

function encodePriceButton(
  state: PriceButtonState,
  kind: 'q' | 'e',
  family: 'p' | 'a',
): string {
  const city = state.city ?? '_';
  return `${family}${kind}:${state.quality}:${state.enchantment}:${city}:${state.item}`;
}

/** Which command a button belongs to. */
export function buttonCommand(customId: string): 'price' | 'arbitrage' | undefined {
  if (customId.startsWith('pq:') || customId.startsWith('pe:')) {
    return 'price';
  }
  if (customId.startsWith('aq:') || customId.startsWith('ae:')) {
    return 'arbitrage';
  }
  return undefined;
}
