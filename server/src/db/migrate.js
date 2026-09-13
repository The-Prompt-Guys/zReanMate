/**
 * Migration runner — `npm run migrate` from server/.
 *
 * Applies every .sql file in server/migrations/ in filename order, once each,
 * recording what ran in schema_migrations. Each file runs inside its own
 * transaction, so a failing migration leaves nothing half-applied.
 *
 * Migration files must NOT contain their own BEGIN/COMMIT — a COMMIT inside a
 * file would close this runner's transaction early and break that guarantee.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool, closePool } from './pool.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

const ensureMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
};

const checksumOf = (sql) => createHash('sha256').update(sql).digest('hex').slice(0, 16);

export const runMigrations = async () => {
  const client = await pool.connect();
  let applied = 0;

  try {
    await ensureMigrationsTable(client);

    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('[migrate] no migration files found in', migrationsDir);
      return 0;
    }

    const { rows } = await client.query('SELECT version, checksum FROM schema_migrations');
    const alreadyApplied = new Map(rows.map((row) => [row.version, row.checksum]));

    for (const file of files) {
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      const checksum = checksumOf(sql);
      const previous = alreadyApplied.get(file);

      if (previous) {
        if (previous !== checksum) {
          throw new Error(
            `Migration ${file} was already applied but its contents changed ` +
              `(${previous} -> ${checksum}). Migrations are immutable once applied; ` +
              'add a new migration instead of editing this one.',
          );
        }
        console.log(`[migrate] skip  ${file} (already applied)`);
        continue;
      }

      console.log(`[migrate] apply ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
          file,
          checksum,
        ]);
        await client.query('COMMIT');
        applied += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`, { cause: err });
      }
    }

    console.log(
      applied === 0
        ? '[migrate] database already up to date'
        : `[migrate] applied ${applied} migration(s)`,
    );
    return applied;
  } finally {
    client.release();
  }
};

// Only run when invoked directly (`npm run migrate`), not when imported.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  try {
    await runMigrations();
  } catch (err) {
    console.error('[migrate]', err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
