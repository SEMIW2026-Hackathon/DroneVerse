import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { closePool, getPool } from './pool.js';

// Usage: pnpm db:migrate  (applies any migrations in ./migrations not yet recorded)
const dir = join(import.meta.dirname, 'migrations');

async function main() {
  const pool = getPool();
  await pool.query(
    `create table if not exists schema_migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );
  const applied = new Set(
    (await pool.query<{ name: string }>('select name from schema_migrations')).rows.map(
      (r) => r.name,
    ),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }
  console.log('migrations up to date');
}

main()
  .catch((err) => {
    // Error text can contain the database host, so print only the error code.
    console.error('migration failed:', (err as { code?: string }).code ?? 'unknown error');
    process.exitCode = 1;
  })
  .finally(closePool);
