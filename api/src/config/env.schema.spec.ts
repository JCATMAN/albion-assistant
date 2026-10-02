import { parseAppConfig } from './env.schema';

const minimumEnv = {
  REDIS_URL: 'redis://:password@host.docker.internal:6379/0',
  ITEMS_URL: 'https://example.com/items.json',
  DISCORD_PUBLIC_KEY: 'public-key',
};

describe('parseAppConfig', () => {
  it('applies defaults when only the required variables are set', () => {
    const config = parseAppConfig(minimumEnv);

    expect(config.port).toBe(3000);
    expect(config.redisUrl).toBe(minimumEnv.REDIS_URL);
    expect(config.itemsUrl).toBe(minimumEnv.ITEMS_URL);
    expect(config.discordPublicKey).toBe(minimumEnv.DISCORD_PUBLIC_KEY);
    expect(config.freshWithinMilliseconds).toBe(30 * 60 * 1000);
    expect(config.catalogRefreshMilliseconds).toBe(60 * 60 * 1000);
  });

  it('does not require the Discord register-script variables at boot', () => {
    expect(parseAppConfig(minimumEnv).discordPublicKey).toBe('public-key');
  });

  it.each(['REDIS_URL', 'ITEMS_URL', 'DISCORD_PUBLIC_KEY'])(
    'names %s when it is missing',
    (name) => {
      const env: Record<string, string | undefined> = { ...minimumEnv };
      delete env[name];

      expect(() => parseAppConfig(env)).toThrow(
        new RegExp(`Missing required environment variable ${name}`),
      );
    },
  );

  it('rejects a FRESH_WITHIN value that is not a duration', () => {
    expect(() =>
      parseAppConfig({ ...minimumEnv, FRESH_WITHIN: 'nope' }),
    ).toThrow(/FRESH_WITHIN/);
  });

  it('rejects PORT 0', () => {
    expect(() => parseAppConfig({ ...minimumEnv, PORT: '0' })).toThrow(/PORT/);
  });
});
