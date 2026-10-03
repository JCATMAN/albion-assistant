import { AlertService } from './alert.service';
import { AlertRedis } from './alert.redis';

class MemoryAlertRedis implements AlertRedis {
  readonly status = 'ready';
  readonly hashes = new Map<string, Record<string, string>>();
  readonly sets = new Map<string, Set<string>>();
  readonly values = new Map<string, string>();

  connect(): Promise<void> {
    return Promise.resolve();
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  set(key: string, value: string): Promise<unknown> {
    this.values.set(key, value);
    return Promise.resolve('OK');
  }

  hset(key: string, fields: Record<string, string>): Promise<unknown> {
    this.hashes.set(key, fields);
    return Promise.resolve(1);
  }

  sadd(key: string, member: string): Promise<unknown> {
    const set = this.sets.get(key) ?? new Set<string>();
    set.add(member);
    this.sets.set(key, set);
    return Promise.resolve(1);
  }

  srem(key: string, member: string): Promise<unknown> {
    this.sets.get(key)?.delete(member);
    return Promise.resolve(1);
  }

  del(...keys: string[]): Promise<unknown> {
    for (const key of keys) {
      this.hashes.delete(key);
      this.values.delete(key);
    }
    return Promise.resolve(keys.length);
  }

  quit(): Promise<unknown> {
    return Promise.resolve('OK');
  }
}

describe('AlertService', () => {
  const draft = {
    item: 'T4_BAG@1',
    name: 'Bolsa del iniciado',
    city: null,
    quality: null,
    enchantment: null,
    side: 'sell' as const,
    target: 13000,
    channelId: '100',
    userId: '42',
  };

  it('stores an open watch on the item index', async () => {
    const redis = new MemoryAlertRedis();
    const service = new AlertService(redis, () => 'id-1');

    await expect(service.save(draft)).resolves.toBe('created');

    expect(redis.hashes.get('alert:id-1')).toMatchObject({
      item: 'T4_BAG',
      city: '*',
      quality: '*',
      enchantment: '*',
      side: 'sell',
      target: '13000',
      channel_id: '100',
      user_id: '42',
    });
    expect(redis.sets.get('alerts:item:T4_BAG')?.has('id-1')).toBe(true);
    expect(redis.values.get('alert-owner:42:T4_BAG:sell')).toBe('id-1');
  });

  it('replaces the previous watch for the same user, item, and side', async () => {
    const redis = new MemoryAlertRedis();
    const ids = ['id-1', 'id-2'];
    const service = new AlertService(redis, () => ids.shift() ?? 'id-x');

    await service.save(draft);
    await expect(
      service.save({ ...draft, city: 'Martlock', target: 9000 }),
    ).resolves.toBe('updated');

    expect(redis.hashes.has('alert:id-1')).toBe(false);
    expect(redis.hashes.get('alert:id-2')).toMatchObject({
      city: 'Martlock',
      target: '9000',
    });
    const members = redis.sets.get('alerts:item:T4_BAG');
    expect(members?.has('id-1')).toBe(false);
    expect(members?.has('id-2')).toBe(true);
  });
});
