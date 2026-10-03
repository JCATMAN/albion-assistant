import { discordCallback, discordDeferType } from './discord-defer';

describe('discordDeferType', () => {
  it('defers the price command and price buttons', () => {
    expect(discordDeferType({ type: 2, data: { name: 'price' } })).toBe(5);
    expect(discordDeferType({ type: 2, data: { name: 'arbitrage' } })).toBe(5);
    expect(
      discordDeferType({ type: 3, data: { custom_id: 'pq:1:0:_:T4_BAG' } }),
    ).toBe(6);
  });

  it('answers pings and autocomplete inline', () => {
    expect(discordDeferType({ type: 1 })).toBeUndefined();
    expect(discordDeferType({ type: 4, data: { name: 'price' } })).toBeUndefined();
  });
});

describe('discordCallback', () => {
  it('reads the application id and token', () => {
    expect(
      discordCallback({ application_id: 'app', token: 'token' }),
    ).toEqual({ applicationId: 'app', token: 'token' });
  });
});
