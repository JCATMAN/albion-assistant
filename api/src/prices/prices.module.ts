import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AppConfig } from '../config/app-config';
import { AppConfigModule } from '../config/config.module';
import { ALBION_PRICES, HttpAlbionPrices } from './albion-prices';
import { CLOCK } from './clock';
import { PRICE_REPOSITORY } from './price.repository';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';
import { createRedisPriceRepository } from './redis-price.repository';

/** Price reads. Redis is constructed only behind the repository token. */
@Module({
  imports: [AppConfigModule, CatalogModule],
  controllers: [PricesController],
  providers: [
    PricesService,
    {
      provide: CLOCK,
      useValue: (): Date => new Date(),
    },
    {
      provide: ALBION_PRICES,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => new HttpAlbionPrices(config.albionApiBase),
    },
    {
      provide: PRICE_REPOSITORY,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        createRedisPriceRepository(config.redisUrl),
    },
  ],
  exports: [PricesService],
})
export class PricesModule {}
