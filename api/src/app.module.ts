import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { AppConfigModule } from './config/config.module';
import { DiscordModule } from './discord/discord.module';
import { HealthModule } from './health/health.module';
import { PricesModule } from './prices/prices.module';

/** Wires the feature modules. It does not register Discord commands. */
@Module({
  imports: [
    AppConfigModule,
    CatalogModule,
    PricesModule,
    DiscordModule,
    HealthModule,
  ],
})
export class AppModule {}
