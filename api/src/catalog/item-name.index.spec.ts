import {
  CatalogItem,
  createItemNameIndex,
  displayName,
} from './item-name.index';

const source: CatalogItem[] = [
  {
    uniqueName: 'T4_BAG',
    tier: 4,
    names: { es: 'Bolsa del iniciado', en: "Adept's Bag" },
  },
  {
    uniqueName: 'T5_HEAD_CLOTH_SET1',
    tier: 5,
    names: { es: 'Capucha de visión', en: null },
  },
  {
    uniqueName: 'JOURNAL_EMPTY',
    tier: null,
    names: { es: null, en: null },
  },
];

describe('item name index', () => {
  const index = createItemNameIndex(source);

  it('finds an item from a Spanish token', () => {
    expect(index.findByToken('bolsa').map((item) => item.uniqueName)).toEqual([
      'T4_BAG',
    ]);
  });

  it('finds the same item from the English token', () => {
    const fromSpanish = index.findByToken('bolsa')[0];
    const fromEnglish = index.findByToken('bag')[0];
    expect(fromEnglish?.uniqueName).toBe('T4_BAG');
    expect(fromEnglish?.uniqueName).toBe(fromSpanish?.uniqueName);
  });

  it('matches vision against visión', () => {
    expect(index.findByToken('vision').map((item) => item.uniqueName)).toEqual(
      ['T5_HEAD_CLOTH_SET1'],
    );
  });

  it('keeps an item with no localized names out of text search and in get', () => {
    expect(index.findByToken('journal')).toEqual([]);
    expect(index.get('JOURNAL_EMPTY')?.uniqueName).toBe('JOURNAL_EMPTY');
  });

  it('returns undefined for an unknown unique name', () => {
    expect(index.get('NO_SUCH_ITEM')).toBeUndefined();
  });

  it('reads tier from a T prefix and leaves other ids null', () => {
    expect(index.get('T4_BAG')?.tier).toBe(4);
    expect(index.get('T4_BAG')?.names).toEqual({
      es: 'Bolsa del iniciado',
      en: "Adept's Bag",
    });
    expect(index.get('JOURNAL_EMPTY')?.tier).toBeNull();
  });

  it('displayName uses Spanish, English, the other language, then the id', () => {
    const bag = index.get('T4_BAG');
    const hood = index.get('T5_HEAD_CLOTH_SET1');
    const journal = index.get('JOURNAL_EMPTY');
    if (!bag || !hood || !journal) {
      throw new Error('expected the three fixture items');
    }

    expect(displayName(bag, 'es')).toBe('Bolsa del iniciado');
    expect(displayName(bag, 'en')).toBe("Adept's Bag");
    expect(displayName(hood, 'en')).toBe('Capucha de visión');
    expect(displayName(journal, 'es')).toBe('JOURNAL_EMPTY');
  });
});
