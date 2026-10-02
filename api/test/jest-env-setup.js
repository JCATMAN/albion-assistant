function ensure(name, value) {
  if (!process.env[name]) {
    process.env[name] = value;
  }
}

ensure('PORT', '3000');
ensure('REDIS_URL', 'redis://127.0.0.1:6379/0');
ensure('ITEMS_URL', 'http://catalog.test/items.json');
ensure('DISCORD_PUBLIC_KEY', 'ab'.repeat(32));
ensure('FRESH_WITHIN', '30m');
ensure('CATALOG_REFRESH', '1h');
