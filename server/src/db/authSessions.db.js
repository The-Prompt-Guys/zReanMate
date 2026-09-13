import { query, queryOne } from './pool.js';

/**
 * SQL for `auth_sessions` — the refresh-token store that makes httpOnly cookie
 * sessions revocable. Only the SHA-256 hash of a refresh token is ever stored,
 * so a database leak does not hand over live sessions.
 */
export const authSessionsDb = {
  async create({ userId, tokenHash, userAgent, ipAddress, expiresAt }) {
    return queryOne(
      `INSERT INTO auth_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4::inet, $5)
       RETURNING id, user_id, expires_at, created_at`,
      [userId, tokenHash, userAgent ?? null, ipAddress ?? null, expiresAt],
    );
  },

  /** Live sessions only — expired or revoked rows return nothing. */
  async findActive(tokenHash) {
    return queryOne(
      `SELECT id, user_id, expires_at
         FROM auth_sessions
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > now()`,
      [tokenHash],
    );
  },

  async revoke(tokenHash) {
    return queryOne(
      `UPDATE auth_sessions
          SET revoked_at = now()
        WHERE token_hash = $1 AND revoked_at IS NULL
        RETURNING id`,
      [tokenHash],
    );
  },

  async revokeAllForUser(userId) {
    const { rowCount } = await query(
      `UPDATE auth_sessions SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
    return rowCount;
  },

  /**
   * Rotation: revoke the old row and issue the new one atomically, so a crash
   * between the two cannot leave a user with zero valid refresh tokens.
   */
  async rotate({ oldTokenHash, userId, tokenHash, userAgent, ipAddress, expiresAt }) {
    const { withTransaction } = await import('./pool.js');
    return withTransaction(async (client) => {
      await client.query('UPDATE auth_sessions SET revoked_at = now() WHERE token_hash = $1', [
        oldTokenHash,
      ]);
      const { rows } = await client.query(
        `INSERT INTO auth_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
         VALUES ($1, $2, $3, $4::inet, $5)
         RETURNING id, user_id, expires_at`,
        [userId, tokenHash, userAgent ?? null, ipAddress ?? null, expiresAt],
      );
      return rows[0];
    });
  },
};
