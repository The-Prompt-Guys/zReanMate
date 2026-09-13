import { query } from '../db/pool.js';
import { env } from '../config/env.js';

export const healthService = {
  async check() {
    let database = 'down';
    let migrations = null;

    try {
      await query('SELECT 1');
      database = 'up';

      // Reports the newest applied migration when schema_migrations exists;
      // stays null before the first `npm run migrate`.
      const { rows } = await query(
        `SELECT version, applied_at
           FROM schema_migrations
          ORDER BY version DESC
          LIMIT 1`,
      );
      migrations = rows[0] ?? null;
    } catch (err) {
      if (err.code === '42P01') {
        // schema_migrations does not exist yet — the DB is reachable, unmigrated.
        migrations = null;
      } else if (database === 'down') {
        console.error('[health] database unreachable:', err.message);
      }
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      migrations,
      env: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },
};
