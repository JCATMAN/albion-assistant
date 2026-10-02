import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyKey } from 'discord-interactions';
import { Request } from 'express';
import { AppConfig } from '../config/app-config';

/** Rejects Discord interaction posts whose Ed25519 signature does not match. */
@Injectable()
export class DiscordSignatureGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const signature = headerValue(request, 'x-signature-ed25519');
    const timestamp = headerValue(request, 'x-signature-timestamp');
    const rawBody = request.rawBody;
    if (!signature || !timestamp || !rawBody) {
      throw new UnauthorizedException('Invalid Discord signature');
    }
    const valid = verifyKey(
      rawBody,
      signature,
      timestamp,
      this.config.discordPublicKey,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid Discord signature');
    }
    return true;
  }
}

function headerValue(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}
