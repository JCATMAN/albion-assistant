import { Controller, Get } from '@nestjs/common';

/** Liveness probe. It does not touch Redis or the catalog. */
@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
