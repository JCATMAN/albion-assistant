import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import nacl from 'tweetnacl';
import { AppConfig } from '../config/app-config';
import { configureHttp } from '../configure-http';
import { DiscordController } from './discord.controller';
import { DiscordSignatureGuard } from './discord-signature.guard';
import { InteractionHandler } from './interaction-handler.service';

function sign(body: string, timestamp: string, secretKey: Uint8Array): string {
  const message = Buffer.from(timestamp + body);
  return Buffer.from(nacl.sign.detached(message, secretKey)).toString('hex');
}

describe('DiscordSignatureGuard', () => {
  let app: INestApplication;
  const handle = jest.fn().mockResolvedValue({ type: 1 });
  const keyPair = nacl.sign.keyPair();
  const publicKey = Buffer.from(keyPair.publicKey).toString('hex');
  const body = JSON.stringify({ type: 1 });
  const timestamp = '1700000000';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DiscordController],
      providers: [
        DiscordSignatureGuard,
        { provide: InteractionHandler, useValue: { handle } },
        {
          provide: AppConfig,
          useValue: new AppConfig({
            port: 3000,
            redisUrl: 'redis://localhost:6379',
            itemsUrl: 'http://catalog.test/items.json',
            freshWithinMilliseconds: 30 * 60 * 1000,
            discordPublicKey: publicKey,
            catalogRefreshMilliseconds: 60 * 60 * 1000,
          }),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    handle.mockClear();
  });

  it('accepts a valid signature and calls the handler', async () => {
    const signature = sign(body, timestamp, keyPair.secretKey);

    await request(app.getHttpServer())
      .post('/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(body)
      .expect(200)
      .expect({ type: 1 });

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('returns 401 for a bad signature and does not call the handler', async () => {
    const signature = sign(body, timestamp, keyPair.secretKey).replace(
      /^./,
      (character) => (character === 'a' ? 'b' : 'a'),
    );

    await request(app.getHttpServer())
      .post('/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(body)
      .expect(401);

    expect(handle).not.toHaveBeenCalled();
  });
});
