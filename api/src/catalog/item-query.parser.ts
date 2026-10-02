import { MARKET_CITIES } from './market-cities';
import { normalizeSearchText } from './normalize-text';

export interface ParsedQuery {
  text: string;
  tier?: number;
  enchantment?: number;
  quality?: number;
  city?: string;
}

interface QualityPhrase {
  phrase: string;
  quality: number;
}

const QUALITY_PHRASES: QualityPhrase[] = [
  { phrase: 'obra maestra', quality: 5 },
  { phrase: 'masterpiece', quality: 5 },
  { phrase: 'outstanding', quality: 3 },
  { phrase: 'destacada', quality: 3 },
  { phrase: 'excellent', quality: 4 },
  { phrase: 'excelente', quality: 4 },
  { phrase: 'normal', quality: 1 },
  { phrase: 'buena', quality: 2 },
  { phrase: 'good', quality: 2 },
].sort((left, right) => right.phrase.length - left.phrase.length);

const CITY_PHRASES = MARKET_CITIES.map((canonical) => ({
  canonical,
  folded: normalizeSearchText(canonical),
})).sort((left, right) => right.folded.length - left.folded.length);

/** Splits a typed phrase into search text plus tier, enchantment, quality, and city. */
export function parseItemQuery(input: string): ParsedQuery {
  let working = normalizeSearchText(input);
  working = working.replace(/\bt\d+(?:_[a-z0-9]+)+(?:@\d+)?\b/g, ' ');

  let city: string | undefined;
  for (const candidate of CITY_PHRASES) {
    const pattern = new RegExp(`\\b${escapeRegExp(candidate.folded)}\\b`, 'g');
    working = working.replace(pattern, () => {
      city ??= candidate.canonical;
      return ' ';
    });
  }

  let quality: number | undefined;
  for (const candidate of QUALITY_PHRASES) {
    const pattern = new RegExp(`\\b${escapeRegExp(candidate.phrase)}\\b`, 'g');
    working = working.replace(pattern, () => {
      quality ??= candidate.quality;
      return ' ';
    });
  }

  working = working.replace(/\bq([1-5])\b/g, (_match, qualityRaw: string) => {
    quality ??= Number(qualityRaw);
    return ' ';
  });

  let tier: number | undefined;
  let enchantment: number | undefined;

  working = working.replace(
    /\b(?:t([0-9])|([0-9]))\.([0-9])\b/g,
    (match, tierWithPrefix: string, tierBare: string, enchantRaw: string) => {
      const tierNumber = Number(tierWithPrefix || tierBare);
      const enchantNumber = Number(enchantRaw);
      if (!inTierRange(tierNumber) || !inEnchantmentRange(enchantNumber)) {
        return match;
      }
      tier ??= tierNumber;
      enchantment ??= enchantNumber;
      return ' ';
    },
  );

  working = working.replace(
    /\bt([0-9])@([0-9])\b/g,
    (match, tierRaw: string, enchantRaw: string) => {
      const tierNumber = Number(tierRaw);
      const enchantNumber = Number(enchantRaw);
      if (!inTierRange(tierNumber) || !inEnchantmentRange(enchantNumber)) {
        return match;
      }
      tier ??= tierNumber;
      enchantment ??= enchantNumber;
      return ' ';
    },
  );

  working = working.replace(
    /\bt([0-9])(?![.@][0-9])\b/g,
    (match, tierRaw: string) => {
      const tierNumber = Number(tierRaw);
      if (!inTierRange(tierNumber)) {
        return match;
      }
      tier ??= tierNumber;
      return ' ';
    },
  );

  const parsed: ParsedQuery = {
    text: working.replace(/\s+/g, ' ').trim(),
  };
  if (tier !== undefined) {
    parsed.tier = tier;
  }
  if (enchantment !== undefined) {
    parsed.enchantment = enchantment;
  }
  if (quality !== undefined) {
    parsed.quality = quality;
  }
  if (city !== undefined) {
    parsed.city = city;
  }
  return parsed;
}

function inTierRange(tier: number): boolean {
  return tier >= 2 && tier <= 8;
}

function inEnchantmentRange(enchantment: number): boolean {
  return enchantment >= 0 && enchantment <= 4;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
