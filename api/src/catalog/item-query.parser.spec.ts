import { parseItemQuery } from './item-query.parser';

describe('parseItemQuery', () => {
  it.each(['t4.1', 'T4.1', '4.1', 't4@1'])(
    'reads tier and enchantment from %s',
    (token) => {
      expect(parseItemQuery(`bolsa ${token}`)).toEqual({
        text: 'bolsa',
        tier: 4,
        enchantment: 1,
      });
    },
  );

  it.each(['t4', 'T4'])('reads tier without enchantment from %s', (token) => {
    expect(parseItemQuery(`bolsa ${token}`)).toEqual({
      text: 'bolsa',
      tier: 4,
    });
  });

  it.each([1, 2, 3, 4, 5])('reads quality from q%s', (quality) => {
    expect(parseItemQuery(`bolsa q${quality}`)).toEqual({
      text: 'bolsa',
      quality,
    });
  });

  it.each([
    ['normal', 1],
    ['good', 2],
    ['outstanding', 3],
    ['excellent', 4],
    ['masterpiece', 5],
    ['buena', 2],
    ['destacada', 3],
    ['excelente', 4],
    ['obra maestra', 5],
  ])('reads quality word %s as %s', (word, quality) => {
    expect(parseItemQuery(`bolsa ${word}`)).toEqual({
      text: 'bolsa',
      quality,
    });
  });

  it.each([
    ['caerleon', 'Caerleon'],
    ['martlock', 'Martlock'],
    ['bridgewatch', 'Bridgewatch'],
    ['lymhurst', 'Lymhurst'],
    ['thetford', 'Thetford'],
    ['fort sterling', 'Fort Sterling'],
    ['black market', 'Black Market'],
    ['brecilien', 'Brecilien'],
  ])('reads city %s as %s', (phrase, canonical) => {
    expect(parseItemQuery(`bolsa ${phrase}`)).toEqual({
      text: 'bolsa',
      city: canonical,
    });
  });

  it('parses bolsa t4.1', () => {
    expect(parseItemQuery('bolsa t4.1')).toEqual({
      text: 'bolsa',
      tier: 4,
      enchantment: 1,
    });
  });

  it('parses adept bag t4', () => {
    expect(parseItemQuery('adept bag t4')).toEqual({
      text: 'adept bag',
      tier: 4,
    });
  });

  it('parses bolsa excelente caerleon', () => {
    expect(parseItemQuery('bolsa excelente caerleon')).toEqual({
      text: 'bolsa',
      quality: 4,
      city: 'Caerleon',
    });
  });

  it('drops a unique name and leaves the text empty', () => {
    expect(parseItemQuery('T4_BAG@1')).toEqual({ text: '' });
  });

  it('returns empty text for an empty string', () => {
    expect(parseItemQuery('')).toEqual({ text: '' });
  });

  it('leaves enchantment 9 inside the text', () => {
    expect(parseItemQuery('t4.9')).toEqual({ text: 't4.9' });
    expect(parseItemQuery('bolsa t4.9')).toEqual({ text: 'bolsa t4.9' });
  });

  it('lowercases BOLSA', () => {
    expect(parseItemQuery('BOLSA')).toEqual({ text: 'bolsa' });
  });

  it('reads fort sterling in the middle of a phrase', () => {
    expect(parseItemQuery('bolsa fort sterling cara')).toEqual({
      text: 'bolsa cara',
      city: 'Fort Sterling',
    });
  });

  it('leaves a tier outside 2-8 in the text', () => {
    expect(parseItemQuery('bolsa t1')).toEqual({ text: 'bolsa t1' });
    expect(parseItemQuery('bolsa t9')).toEqual({ text: 'bolsa t9' });
  });

  it('leaves an enchantment outside 0-4 in the text', () => {
    expect(parseItemQuery('bolsa t4@5')).toEqual({ text: 'bolsa t4@5' });
  });

  it('ignores a quality outside 1-5', () => {
    expect(parseItemQuery('bolsa q6')).toEqual({ text: 'bolsa q6' });
    expect(parseItemQuery('bolsa q0')).toEqual({ text: 'bolsa q0' });
  });
});
