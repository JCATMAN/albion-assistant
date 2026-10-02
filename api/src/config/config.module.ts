import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppConfig } from './app-config';
import { parseAppConfig, toEnvRecord } from './env.schema';

/** Loads and validates the environment, then exposes one AppConfig. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, unknown>) => {
        const parsed = parseAppConfig(toEnvRecord(env));
        return {
          port: parsed.port,
          redisUrl: parsed.redisUrl,
          itemsUrl: parsed.itemsUrl,
          freshWithinMilliseconds: parsed.freshWithinMilliseconds,
          discordPublicKey: parsed.discordPublicKey,
          catalogRefreshMilliseconds: parsed.catalogRefreshMilliseconds,
        };
      },
    }),
  ],
  providers: [
    {
      provide: AppConfig,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): AppConfig =>
        new AppConfig({
          port: configService.getOrThrow<number>('port'),
          redisUrl: configService.getOrThrow<string>('redisUrl'),
          itemsUrl: configService.getOrThrow<string>('itemsUrl'),
          freshWithinMilliseconds: configService.getOrThrow<number>(
            'freshWithinMilliseconds',
          ),
          discordPublicKey: configService.getOrThrow<string>('discordPublicKey'),
          catalogRefreshMilliseconds: configService.getOrThrow<number>(
            'catalogRefreshMilliseconds',
          ),
        }),
    },
  ],
  exports: [AppConfig],
})
export class AppConfigModule {}
