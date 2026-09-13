import pg from 'pg';
import { env, isProduction } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[db] idle client error', err);
});

/**
 * Run a parameterized query. Never interpolate values into `text` — pass them
 * as $1, $2, ... in `params` (CLAUDE.md, Database).
 */
export const query = (text, params) => pool.query(text, params);

/** Convenience for queries that must match exactly one row. */
export const queryOne = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
};

/**
 * Run `fn` inside a transaction, rolling back on any throw.
 * `fn` receives a dedicated client — use it for every statement in the unit.
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const closePool = () => pool.end();
