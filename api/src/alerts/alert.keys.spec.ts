import { alertIndexKey, alertOwnerKey, alertRecordKey } from './alert.keys';

describe('alert keys', () => {
  it('matches the writer contract', () => {
    expect(alertRecordKey('abc')).toBe('alert:abc');
    expect(alertIndexKey('T4_BAG')).toBe('alerts:item:T4_BAG');
    expect(alertOwnerKey('42', 'T4_BAG', 'sell')).toBe('alert-owner:42:T4_BAG:sell');
  });
});
