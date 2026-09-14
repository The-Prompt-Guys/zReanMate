import { query, queryOne } from './pool.js';

export const CONSUME_QUOTA_SQL = `
  INSERT INTO usage_counters (user_id, counter_key, period_start, quantity)
  SELECT $1, $2, $3::date, $4
   WHERE EXISTS (
     SELECT 1 FROM users u
     JOIN plan_limits pl ON pl.plan_tier = u.plan_tier AND pl.limit_key = $2
     WHERE u.id = $1 AND (pl.limit_value IS NULL OR $4 <= pl.limit_value)
   )
  ON CONFLICT (user_id, counter_key, period_start) DO UPDATE
    SET quantity = usage_counters.quantity + EXCLUDED.quantity
  WHERE EXISTS (
    SELECT 1 FROM users u
    JOIN plan_limits pl ON pl.plan_tier = u.plan_tier AND pl.limit_key = $2
    WHERE u.id = $1
      AND (pl.limit_value IS NULL OR usage_counters.quantity + EXCLUDED.quantity <= pl.limit_value)
  )
  RETURNING quantity, (
    SELECT pl.limit_value FROM users u
    JOIN plan_limits pl ON pl.plan_tier = u.plan_tier AND pl.limit_key = $2
    WHERE u.id = $1
  ) AS limit_value
`;

export const plansDb = {
  async tier(userId) { return queryOne(`SELECT plan_tier FROM users WHERE id = $1 AND status <> 'deleted'`, [userId]); },
  async consume({ userId, counterKey, periodStart, amount = 1 }) {
    return queryOne(CONSUME_QUOTA_SQL, [userId, counterKey, periodStart, amount]);
  },
  async limit(userId, key) {
    return queryOne(
      `SELECT pl.limit_value FROM users u JOIN plan_limits pl ON pl.plan_tier = u.plan_tier
        WHERE u.id = $1 AND pl.limit_key = $2`, [userId, key],
    );
  },
  async feature(userId, key) {
    return queryOne(
      `SELECT pf.enabled FROM users u JOIN plan_features pf ON pf.plan_tier = u.plan_tier
        WHERE u.id = $1 AND pf.feature_key = $2`, [userId, key],
    );
  },
  async all(userId, periodStart) {
    const { rows } = await query(
      `SELECT u.plan_tier,
              COALESCE((SELECT jsonb_object_agg(pl.limit_key, jsonb_build_object(
                'limit', pl.limit_value,
                'used', CASE pl.limit_key
                  WHEN 'max_kits' THEN (SELECT count(*)::int FROM study_kits k WHERE k.user_id = u.id AND k.class_id IS NULL)
                  WHEN 'practice_sessions_per_week' THEN (SELECT count(*)::int FROM practice_sessions ps WHERE ps.user_id = u.id AND ps.created_at >= date_trunc('week', now() AT TIME ZONE 'UTC'))
                  ELSE COALESCE((SELECT uc.quantity FROM usage_counters uc WHERE uc.user_id = u.id AND uc.counter_key = pl.limit_key AND uc.period_start = $2), 0)
                END
              )) FROM plan_limits pl WHERE pl.plan_tier = u.plan_tier), '{}'::jsonb) AS limits,
              COALESCE((SELECT jsonb_object_agg(pf.feature_key, pf.enabled) FROM plan_features pf WHERE pf.plan_tier = u.plan_tier), '{}'::jsonb) AS features
         FROM users u WHERE u.id = $1`, [userId, periodStart],
    );
    return rows[0] ?? null;
  },
  async catalog() {
    const [limits, features] = await Promise.all([
      query(`SELECT plan_tier, limit_key, limit_value FROM plan_limits ORDER BY plan_tier, limit_key`),
      query(`SELECT plan_tier, feature_key, enabled FROM plan_features ORDER BY plan_tier, feature_key`),
    ]);
    return { limits: limits.rows, features: features.rows };
  },
};
