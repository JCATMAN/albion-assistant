import { Controller, Get, Query } from '@nestjs/common';
import { PriceQueryDto } from './price-query.dto';
import { PriceResponse } from './price.types';
import { PricesService } from './prices.service';

/** HTTP price cells. Validation stays on the DTO; freshness stays in the service. */
@Controller('prices')
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Get()
  getPrices(@Query() query: PriceQueryDto): Promise<PriceResponse> {
    return this.prices.get(query);
  }
}
