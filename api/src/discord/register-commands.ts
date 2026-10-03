import { alertCommand } from './alert-command';
import { arbitrageCommand } from './arbitrage-command';
import { priceCommand } from './price-command';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

/** Registers price, arbitrage, and alert. Run with npm run register:commands, not at boot. */
async function registerCommands(): Promise<void> {
  const token = required('DISCORD_TOKEN');
  const applicationId = required('DISCORD_APP_ID');
  const response = await fetch(
    `https://discord.com/api/v10/applications/${applicationId}/commands`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([priceCommand, arbitrageCommand, alertCommand]),
    },
  );
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Discord command registration failed with HTTP ${response.status}: ${details}`,
    );
  }
}

registerCommands().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Command registration failed';
  console.error(message);
  process.exit(1);
});
