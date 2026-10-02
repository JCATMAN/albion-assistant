import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Health route used by the process probe. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
