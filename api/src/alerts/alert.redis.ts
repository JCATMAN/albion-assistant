import Redis from 'ioredis';

/** Commands the alert service uses. Tests pass a fake. */
export interface AlertRedis {
  readonly status: string;
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  hset(key: string, fields: Record<string, string>): Promise<unknown>;
  sadd(key: string, member: string): Promise<unknown>;
  srem(key: string, member: string): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  quit(): Promise<unknown>;
}

/** Injection token for the Redis client behind AlertService. */
export const ALERT_REDIS = Symbol('ALERT_REDIS');

/** Injection token for alert id generation. */
export const ALERT_IDS = Symbol('ALERT_IDS');

/** Builds the production client from REDIS_URL. Tests never call this. */
export function createAlertRedis(redisUrl: string): AlertRedis {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy: () => null,
  });
  return new IoredisAlertClient(redis);
}

class IoredisAlertClient implements AlertRedis {
  constructor(private readonly redis: Redis) {}

  get status(): string {
    return this.redis.status;
  }

  connect(): Promise<void> {
    return this.redis.connect();
  }

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  set(key: string, value: string): Promise<unknown> {
    return this.redis.set(key, value);
  }

  hset(key: string, fields: Record<string, string>): Promise<unknown> {
    return this.redis.hset(key, fields);
  }

  sadd(key: string, member: string): Promise<unknown> {
    return this.redis.sadd(key, member);
  }

  srem(key: string, member: string): Promise<unknown> {
    return this.redis.srem(key, member);
  }

  del(...keys: string[]): Promise<unknown> {
    return this.redis.del(...keys);
  }

  quit(): Promise<unknown> {
    if (this.redis.status === 'wait' || this.redis.status === 'end') {
      this.redis.disconnect();
      return Promise.resolve('OK');
    }
    return this.redis.quit();
  }
}
