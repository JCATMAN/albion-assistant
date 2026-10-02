import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AppConfigModule } from '../config/config.module';
import { PricesModule } from '../prices/prices.module';
import { DiscordController } from './discord.controller';
import { DiscordSignatureGuard } from './discord-signature.guard';
import { InteractionHandler } from './interaction-handler.service';

/** Discord interactions. The register script is not a provider and does not run here. */
@Module({
  imports: [AppConfigModule, CatalogModule, PricesModule],
  controllers: [DiscordController],
  providers: [DiscordSignatureGuard, InteractionHandler],
})
export class DiscordModule {}
