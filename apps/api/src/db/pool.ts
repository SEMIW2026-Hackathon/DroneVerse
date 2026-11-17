import pg from 'pg';
import { requireEnv } from '../env.js';

let pool: pg.Pool | undefined;

function isLocal(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

/** Shared connection pool. Hosted databases (e.g. Supabase) are reached over TLS. */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = requireEnv('DATABASE_URL');
    pool = new pg.Pool({
      connectionString,
      max: 5,
      ssl: isLocal(connectionString) ? false : { rejectUnauthorized: false },
    });
    // Error text can contain the database host; log only the error code.
    pool.on('error', (err) =>
      console.error('postgres pool error:', (err as { code?: string }).code),
    );
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
