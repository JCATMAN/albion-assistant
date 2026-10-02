import { searchableWords } from './normalize-text';

export type CatalogLocale = 'es' | 'en';

export interface CatalogItem {
  uniqueName: string;
  tier: number | null;
  names: { es: string | null; en: string | null };
}

export interface ItemNameIndex {
  findByToken(token: string): CatalogItem[];
  get(uniqueName: string): CatalogItem | undefined;
}

interface SearchEntry {
  item: CatalogItem;
  words: string[];
}

/** Builds the in-memory name index. Items with no localized names stay get-only. */
export function createItemNameIndex(items: CatalogItem[]): ItemNameIndex {
  const byUniqueName = new Map<string, CatalogItem>();
  const searchable: SearchEntry[] = [];

  for (const raw of items) {
    const item: CatalogItem = {
      uniqueName: raw.uniqueName,
      tier: tierFromUniqueName(raw.uniqueName),
      names: {
        es: blankToNull(raw.names.es),
        en: blankToNull(raw.names.en),
      },
    };
    byUniqueName.set(item.uniqueName, item);
    const words = [
      ...searchableWords(item.names.es ?? ''),
      ...searchableWords(item.names.en ?? ''),
    ];
    if (words.length > 0) {
      searchable.push({ item, words });
    }
  }

  return {
    findByToken(token: string): CatalogItem[] {
      const wanted = searchableWords(token);
      if (wanted.length === 0) {
        return [];
      }
      return searchable
        .filter((entry) =>
          wanted.every((word) =>
            entry.words.some((candidate) => candidate.startsWith(word)),
          ),
        )
        .map((entry) => entry.item);
    },
    get(uniqueName: string): CatalogItem | undefined {
      return byUniqueName.get(uniqueName);
    },
  };
}

/** Visible name for a locale, then the other language, then the unique name. */
export function displayName(item: CatalogItem, locale: CatalogLocale): string {
  const preferred = item.names[locale];
  if (preferred) {
    return preferred;
  }
  const alternate = locale === 'es' ? item.names.en : item.names.es;
  if (alternate) {
    return alternate;
  }
  return item.uniqueName;
}

/** True when the localized name starts with the query words, in order. */
export function itemNameStartsWith(item: CatalogItem, text: string): boolean {
  const wanted = searchableWords(text);
  if (wanted.length === 0) {
    return false;
  }
  const names = [item.names.es, item.names.en].filter(
    (name): name is string => name !== null && name.length > 0,
  );
  return names.some((name) => {
    const words = searchableWords(name);
    return wanted.every(
      (word, index) => words[index]?.startsWith(word) ?? false,
    );
  });
}

/** Tier encoded by a T4/T5 style prefix, or null when the id has none. */
export function tierFromUniqueName(uniqueName: string): number | null {
  const match = /^T(\d+)/.exec(uniqueName);
  if (!match?.[1]) {
    return null;
  }
  return Number(match[1]);
}

/** Maps an items.json document into catalog records, skipping rows without an id. */
export function catalogItemsFromPayload(payload: unknown): CatalogItem[] {
  if (!Array.isArray(payload)) {
    throw new Error('Catalog payload must be a JSON array');
  }
  const items: CatalogItem[] = [];
  for (const entry of payload) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }
    const uniqueName = record.UniqueName;
    if (typeof uniqueName !== 'string' || uniqueName.trim() === '') {
      continue;
    }
    const localized = asRecord(record.LocalizedNames);
    items.push({
      uniqueName,
      tier: tierFromUniqueName(uniqueName),
      names: {
        es: readLocalizedName(localized, 'ES-ES'),
        en: readLocalizedName(localized, 'EN-US'),
      },
    });
  }
  return items;
}

function readLocalizedName(
  localized: Record<string, unknown> | undefined,
  key: string,
): string | null {
  if (!localized) {
    return null;
  }
  const value = localized[key];
  return typeof value === 'string' ? value : null;
}

function blankToNull(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}
