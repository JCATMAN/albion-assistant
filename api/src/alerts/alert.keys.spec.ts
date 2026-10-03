import { alertIndexKey, alertOwnerKey, alertRecordKey } from './alert.keys';

describe('alert keys', () => {
  const cell = 'west:T4_BAG:Fort Sterling:q1:e0';

  it('matches the writer contract', () => {
    expect(alertRecordKey('abc')).toBe('alert:abc');
    expect(alertIndexKey(cell)).toBe('alerts:west:T4_BAG:Fort Sterling:q1:e0');
    expect(alertOwnerKey('42', cell, 'sell')).toBe(
      'alert-owner:42:west:T4_BAG:Fort Sterling:q1:e0:sell',
    );
  });
});
