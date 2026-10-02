import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DiscordSignatureGuard } from './discord-signature.guard';
import {
  InteractionHandler,
  InteractionResponse,
} from './interaction-handler.service';

/** Discord interaction endpoint. The guard checks the raw body before the handler runs. */
@Controller('discord')
export class DiscordController {
  constructor(private readonly interactions: InteractionHandler) {}

  @Post('interactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DiscordSignatureGuard)
  handle(@Body() body: unknown): Promise<InteractionResponse> {
    return this.interactions.handle(body);
  }
}
