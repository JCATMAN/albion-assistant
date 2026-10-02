import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService, ItemSuggestion } from './catalog.service';
import { SuggestQueryDto } from './suggest-query.dto';

/** HTTP suggestions. This controller does not read Redis. */
@Controller('items')
export class ItemsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('suggest')
  suggest(@Query() query: SuggestQueryDto): ItemSuggestion[] {
    return this.catalog.suggest(query.q, query.locale ?? 'es');
  }
}
