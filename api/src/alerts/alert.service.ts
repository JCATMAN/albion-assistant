import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { cellKey } from '../prices/cell-key';
import { alertIndexKey, alertOwnerKey, alertRecordKey } from './alert.keys';
import { ALERT_IDS, ALERT_REDIS, AlertRedis } from './alert.redis';

export type AlertSide = 'sell' | 'buy';

export interface AlertDraft {
  item: string;
  name: string;
  city: string;
  quality: number;
  enchantment: number;
  side: AlertSide;
  target: number;
  channelId: string;
  userId: string;
}

/** Stores one Discord watch per user, cell, and side. The writer is the only sender. */
@Injectable()
export class AlertService implements OnApplicationShutdown {
  constructor(
    @Inject(ALERT_REDIS) private readonly redis: AlertRedis,
    @Inject(ALERT_IDS) private readonly ids: () => string,
  ) {}

  /** Replaces a previous watch for the same user, cell, and side. */
  async save(draft: AlertDraft): Promise<'created' | 'updated'> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
    const baseItem = draft.item.replace(/@[0-4]$/, '');
    const marketKey = cellKey({
      uniqueName: baseItem,
      city: draft.city,
      quality: draft.quality,
      enchantment: draft.enchantment,
    });
    const owner = alertOwnerKey(draft.userId, marketKey, draft.side);
    const previous = await this.redis.get(owner);
    if (previous) {
      await this.redis.del(alertRecordKey(previous));
      await this.redis.srem(alertIndexKey(marketKey), previous);
    }
    const id = this.ids();
    await this.redis.hset(alertRecordKey(id), {
      item: baseItem,
      name: draft.name,
      city: draft.city,
      quality: String(draft.quality),
      enchantment: String(draft.enchantment),
      side: draft.side,
      target: String(draft.target),
      channel_id: draft.channelId,
      user_id: draft.userId,
    });
    await this.redis.sadd(alertIndexKey(marketKey), id);
    await this.redis.set(owner, id);
    return previous ? 'updated' : 'created';
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
