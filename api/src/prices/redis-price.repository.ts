import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import {
  ApiCellWrite,
  emptyStoredCell,
  PriceRepository,
  StoredCell,
} from './price.repository';

/** Client surface the repository needs. Tests pass a fake pipeline. */
export interface HashPipeline {
  hgetall(key: string): HashPipeline;
  hset(key: string, fields: Record<string, string>): HashPipeline;
  expire(key: string, seconds: number): HashPipeline;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

export interface HashRedisClient {
  readonly status: string;
  connect(): Promise<void>;
  pipeline(): HashPipeline;
  quit(): Promise<unknown>;
}

/** Injection token for the Redis client behind RedisPriceRepository. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Reads price hashes with a pipelined HGETALL. It never scans the instance. */
@Injectable()
export class RedisPriceRepository
  implements PriceRepository, OnApplicationShutdown
{
  constructor(@Inject(REDIS_CLIENT) private readonly client: HashRedisClient) {}

  async getMany(keys: string[]): Promise<Map<string, StoredCell>> {
    const stored = new Map<string, StoredCell>();
    if (keys.length === 0) {
      return stored;
    }
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    const pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.hgetall(key);
    }
    const results = await pipeline.exec();
    if (!results) {
      throw new Error('Redis pipeline returned no results');
    }
    keys.forEach((key, index) => {
      const row = results[index];
      if (!row) {
        stored.set(key, emptyStoredCell());
        return;
      }
      const [error, payload] = row;
      if (error) {
        throw error;
      }
      stored.set(key, storedCellFromHash(payload));
    });
    return stored;
  }

  /** Writes sell/buy prices from the West API. Amounts stay untouched. */
  async saveApiPrices(writes: ApiCellWrite[]): Promise<void> {
    const filled = writes.filter(
      (write) =>
        (write.sellMin !== null && write.sellMin > 0) ||
        (write.buyMax !== null && write.buyMax > 0),
    );
    if (filled.length === 0) {
      return;
    }
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    const pipeline = this.client.pipeline();
    for (const write of filled) {
      const fields: Record<string, string> = {
        updated_at: String(write.observedAtUnix),
        source: 'api',
      };
      if (write.sellMin !== null && write.sellMin > 0) {
        fields.sell_min = String(write.sellMin);
        fields.sell_avg = String(write.sellMin);
      }
      if (write.buyMax !== null && write.buyMax > 0) {
        fields.buy_max = String(write.buyMax);
        fields.buy_avg = String(write.buyMax);
      }
      pipeline.hset(write.key, fields);
      pipeline.expire(write.key, 2 * 60 * 60);
    }
    const results = await pipeline.exec();
    if (!results) {
      throw new Error('Redis pipeline returned no results');
    }
    for (const [error] of results) {
      if (error) {
        throw error;
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }
}

/** Builds the production client from REDIS_URL. Tests never call this. */
export function createRedisPriceRepository(
  redisUrl: string,
): RedisPriceRepository {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy: () => null,
  });
  return new RedisPriceRepository(new IoredisHashClient(redis));
}

class IoredisHashClient implements HashRedisClient {
  constructor(private readonly redis: Redis) {}

  get status(): string {
    return this.redis.status;
  }

  connect(): Promise<void> {
    return this.redis.connect();
  }

  pipeline(): HashPipeline {
    const raw = this.redis.pipeline();
    const wrapper: HashPipeline = {
      hgetall(key: string): HashPipeline {
        raw.hgetall(key);
        return wrapper;
      },
      hset(key: string, fields: Record<string, string>): HashPipeline {
        raw.hset(key, fields);
        return wrapper;
      },
      expire(key: string, seconds: number): HashPipeline {
        raw.expire(key, seconds);
        return wrapper;
      },
      exec(): Promise<Array<[Error | null, unknown]> | null> {
        return raw.exec();
      },
    };
    return wrapper;
  }

  quit(): Promise<unknown> {
    return this.redis.quit();
  }
}

function storedCellFromHash(payload: unknown): StoredCell {
  const record = asRecord(payload);
  if (!record) {
    return emptyStoredCell();
  }
  return {
    sellMin: parseInteger(readString(record, 'sell_min')),
    sellAmount: parseInteger(readString(record, 'sell_amount')),
    sellAvg: parseInteger(readString(record, 'sell_avg')),
    buyMax: parseInteger(readString(record, 'buy_max')),
    buyAmount: parseInteger(readString(record, 'buy_amount')),
    buyAvg: parseInteger(readString(record, 'buy_avg')),
    updatedAt: parseInteger(readString(record, 'updated_at')),
    source: parseSource(readString(record, 'source')),
  };
}

function parseSource(value: string | undefined): 'nats' | 'api' | null {
  if (value === 'nats' || value === 'api') {
    return value;
  }
  return null;
}

function parseInteger(value: string | undefined): number | null {
  if (value === undefined || !/^-?\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}

function readString(
  record: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = record[field];
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}
