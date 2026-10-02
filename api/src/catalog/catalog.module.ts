import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { CATALOG_FETCH, CatalogFetch } from './catalog.fetch';
import { CatalogService } from './catalog.service';
import { ItemsController } from './items.controller';

const downloadCatalog: CatalogFetch = (url) => fetch(url);

/** Item names and suggestions. Does not import the prices module. */
@Module({
  imports: [AppConfigModule],
  controllers: [ItemsController],
  providers: [
    CatalogService,
    { provide: CATALOG_FETCH, useValue: downloadCatalog },
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
