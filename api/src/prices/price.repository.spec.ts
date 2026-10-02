import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { emptyStoredCell, StoredCell } from './price.repository';
import {
  HashPipeline,
  HashRedisClient,
  REDIS_CLIENT,
  RedisPriceRepository,
} from './redis-price.repository';

function fakeClient(
  hashes: Record<string, Record<string, string> | undefined>,
): HashRedisClient {
  return {
    status: 'ready',
    connect: () => Promise.resolve(),
    pipeline(): HashPipeline {
      const keys: string[] = [];
      const pipeline: HashPipeline = {
        hgetall(key: string): HashPipeline {
          keys.push(key);
          return pipeline;
        },
        exec: () =>
          Promise.resolve(
            keys.map((key) => {
              const hash = hashes[key];
              return [null, hash ?? {}] as [Error | null, unknown];
            }),
          ),
      };
      return pipeline;
    },
    quit: () => Promise.resolve('OK'),
  };
}

describe('RedisPriceRepository', () => {
  const presentKey = 'west:T4_BAG:Caerleon:q1:e0';

  async function repositoryFor(
    hashes: Record<string, Record<string, string> | undefined>,
  ): Promise<RedisPriceRepository> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisPriceRepository,
        { provide: REDIS_CLIENT, useValue: fakeClient(hashes) },
      ],
    }).compile();
    return moduleRef.get(RedisPriceRepository);
  }

  it('reads a stored hash', async () => {
    const repository = await repositoryFor({
      [presentKey]: {
        sell_min: '4978',
        sell_amount: '3',
        sell_avg: '5000',
        buy_max: '4000',
        buy_amount: '1',
        buy_avg: '3900',
        updated_at: '1710000000',
        source: 'nats',
      },
    });

    const stored = await repository.getMany([presentKey]);
    expect(stored.get(presentKey)).toEqual<StoredCell>({
      sellMin: 4978,
      sellAmount: 3,
      sellAvg: 5000,
      buyMax: 4000,
      buyAmount: 1,
      buyAvg: 3900,
      updatedAt: 1710000000,
      source: 'nats',
    });
  });

  it('returns null fields when the key is absent', async () => {
    const repository = await repositoryFor({});
    const stored = await repository.getMany([presentKey]);
    expect(stored.get(presentKey)).toEqual(emptyStoredCell());
  });

  it('keeps a missing sell_amount as null', async () => {
    const repository = await repositoryFor({
      [presentKey]: {
        sell_min: '4978',
        source: 'api',
        updated_at: '1710000000',
      },
    });

    const cell = (await repository.getMany([presentKey])).get(presentKey);
    expect(cell?.sellMin).toBe(4978);
    expect(cell?.sellAmount).toBeNull();
    expect(cell?.source).toBe('api');
  });
});
