import { query, queryOne } from './pool.js';

/**
 * SQL for the `users` table. Parameterized only — no string interpolation
 * anywhere (CLAUDE.md, Database).
 *
 * Every read here selects an explicit column list rather than `*`, so
 * password_hash cannot leak into an API response by accident.
 */

const PUBLIC_COLUMNS = `
  id, full_name, email, phone, avatar_url, role, locale,
  plan_tier, plan_status, trial_started_at, trial_ends_at, plan_period_end,
  phone_verified_at, email_verified_at, onboarding_completed_at,
  status, last_seen_at, created_at, updated_at
`;

export const usersDb = {
  /**
   * `verifiedAt` is set by the service to a fixed timestamp while no SMS/email
   * provider exists — see auth.service.js. The columns stay in the schema so
   * turning verification on later is a policy change, not a migration.
   */
  async create({ fullName, email, phone, passwordHash, locale = 'km', verifiedAt }) {
    return queryOne(
      `INSERT INTO users (full_name, email, phone, password_hash, locale,
                          phone_verified_at, email_verified_at)
       VALUES ($1, $2, $3, $4, $5,
               CASE WHEN $3::text IS NULL THEN NULL ELSE $6::timestamptz END,
               CASE WHEN $2::text IS NULL THEN NULL ELSE $6::timestamptz END)
       RETURNING ${PUBLIC_COLUMNS}`,
      [fullName ?? null, email ?? null, phone ?? null, passwordHash, locale, verifiedAt],
    );
  },

  /** Includes password_hash — only for the login path. */
  async findForLogin(identifier) {
    return queryOne(
      `SELECT ${PUBLIC_COLUMNS}, password_hash
         FROM users
        WHERE (email = $1 OR phone = $1)
          AND status = 'active'
        LIMIT 1`,
      [identifier],
    );
  },

  async findById(id) {
    return queryOne(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1 AND status <> 'deleted'`, [
      id,
    ]);
  },

  /** Cheap pre-check so a duplicate signup reads as 409, not a constraint error. */
  async identifierTaken({ email, phone }) {
    const { rows } = await query(
      `SELECT (email = $1) AS email_taken, (phone = $2) AS phone_taken
         FROM users
        WHERE ($1::text IS NOT NULL AND email = $1)
           OR ($2::text IS NOT NULL AND phone = $2)`,
      [email ?? null, phone ?? null],
    );
    return {
      email: rows.some((r) => r.email_taken),
      phone: rows.some((r) => r.phone_taken),
    };
  },

  async setRole(id, role) {
    return queryOne(
      `UPDATE users SET role = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
      [id, role],
    );
  },

  async markOnboardingComplete(id) {
    return queryOne(
      `UPDATE users
          SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
        WHERE id = $1
        RETURNING ${PUBLIC_COLUMNS}`,
      [id],
    );
  },

  async touchLastSeen(id) {
    await query('UPDATE users SET last_seen_at = now() WHERE id = $1', [id]);
  },
};
