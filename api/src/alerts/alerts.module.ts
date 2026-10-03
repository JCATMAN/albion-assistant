import { Module } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfig } from '../config/app-config';
import { AppConfigModule } from '../config/config.module';
import { AlertService } from './alert.service';
import { ALERT_IDS, ALERT_REDIS, createAlertRedis } from './alert.redis';

/** Discord watches. The writer reads the same keys and sends the message. */
@Module({
  imports: [AppConfigModule],
  providers: [
    AlertService,
    {
      provide: ALERT_IDS,
      useValue: (): string => randomUUID(),
    },
    {
      provide: ALERT_REDIS,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => createAlertRedis(config.redisUrl),
    },
  ],
  exports: [AlertService],
})
export class AlertsModule {}
