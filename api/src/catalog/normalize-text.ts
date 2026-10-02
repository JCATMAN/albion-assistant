/** Lowercases text and strips accents so Spanish and English tokens compare equally. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Splits a name into searchable words, dropping apostrophes such as Adept's. */
export function searchableWords(value: string): string[] {
  return normalizeSearchText(value)
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}
