export interface CellKeyInput {
  uniqueName: string;
  city: string;
  quality: number;
  enchantment: number;
}

/** Redis hash key. Enchantment lives in eN; a trailing @N on the id is stripped. */
export function cellKey(input: CellKeyInput): string {
  const baseUniqueName = input.uniqueName.replace(/@[0-4]$/, '');
  return `west:${baseUniqueName}:${input.city}:q${input.quality}:e${input.enchantment}`;
}
