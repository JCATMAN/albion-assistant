import { iconUrl } from './icon-url';

const root = 'https://render.albiononline.com/v1/item';

describe('iconUrl', () => {
  it('builds a normal-quality icon for an unenchanted item', () => {
    expect(iconUrl('T4_BAG', 1)).toBe(`${root}/T4_BAG.png?quality=1&size=100`);
  });

  it('adds a single enchantment suffix', () => {
    expect(iconUrl('T4_BAG@1', 2)).toBe(
      `${root}/T4_BAG@1.png?quality=2&size=100`,
    );
  });

  it('does not duplicate an existing @1', () => {
    expect(iconUrl('T4_BAG@1', 2, 100)).toBe(
      `${root}/T4_BAG@1.png?quality=2&size=100`,
    );
  });

  it('treats quality 0 as quality 1', () => {
    expect(iconUrl('T4_BAG', 0)).toBe(`${root}/T4_BAG.png?quality=1&size=100`);
  });

  it('clamps size 400 to 217', () => {
    expect(iconUrl('T4_BAG', 1, 400)).toBe(
      `${root}/T4_BAG.png?quality=1&size=217`,
    );
  });
});
