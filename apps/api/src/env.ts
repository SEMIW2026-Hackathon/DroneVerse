import { join } from 'node:path';

// Load the repo-root .env (apps/api/src or apps/api/dist -> three levels up).
// Existing environment variables win. This never prints the file's contents.
try {
  process.loadEnvFile(join(import.meta.dirname, '..', '..', '..', '.env'));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
