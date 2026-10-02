import { AppConfig, WEST_ALBION_API_BASE } from './app-config';

const DURATION_PATTERN = /^(\d+)(s|m|h)$/;

/** Turns a ConfigModule env bag into the record the parser accepts. */
export function toEnvRecord(
  env: Record<string, unknown>,
): Record<string, string | undefined> {
  const record: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      record[key] = value;
    }
  }
  return record;
}

/** Parses environment variables into AppConfig. Tests pass a record, not process.env. */
export function parseAppConfig(
  env: Record<string, string | undefined>,
): AppConfig {
  return new AppConfig({
    port: parsePort(read(env, 'PORT')),
    redisUrl: required(env, 'REDIS_URL'),
    itemsUrl: required(env, 'ITEMS_URL'),
    freshWithinMilliseconds: optionalDuration(env, 'FRESH_WITHIN', '30m'),
    discordPublicKey: required(env, 'DISCORD_PUBLIC_KEY'),
    catalogRefreshMilliseconds: optionalDuration(env, 'CATALOG_REFRESH', '1h'),
    albionApiBase: optionalText(env, 'ALBION_API_BASE', WEST_ALBION_API_BASE),
  });
}

function read(
  env: Record<string, string | undefined>,
  name: string,
): string | undefined {
  const value = env[name];
  if (value === undefined) {
    return undefined;
  }
  return value.trim();
}

function required(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = read(env, name);
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function optionalText(
  env: Record<string, string | undefined>,
  name: string,
  fallback: string,
): string {
  const value = read(env, name);
  if (value === undefined || value === '') {
    return fallback;
  }
  return value.replace(/\/$/, '');
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined) {
    return 3000;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  const port = Number(raw);
  if (port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  return port;
}

function optionalDuration(
  env: Record<string, string | undefined>,
  name: string,
  fallback: string,
): number {
  const raw = read(env, name);
  if (raw === undefined) {
    return parseDuration(fallback, name);
  }
  return parseDuration(raw, name);
}

function parseDuration(raw: string, name: string): number {
  const match = DURATION_PATTERN.exec(raw);
  if (!match) {
    throw new Error(`${name} must be a duration like 30m or 1h`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isInteger(amount) || amount <= 0 || unit === undefined) {
    throw new Error(`${name} must be a positive duration`);
  }
  if (unit === 's') {
    return amount * 1000;
  }
  if (unit === 'm') {
    return amount * 60_000;
  }
  return amount * 3_600_000;
}
