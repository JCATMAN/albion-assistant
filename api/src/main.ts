import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';
import { configureHttp } from './configure-http';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureHttp(app);
  const config = app.get(AppConfig);
  await app.listen(config.port);
}

bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Application failed to start';
  console.error(message);
  process.exit(1);
});
