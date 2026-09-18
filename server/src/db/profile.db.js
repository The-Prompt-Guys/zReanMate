import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { query, queryOne } from './pool.js';
import { uploadRoot } from '../middleware/upload.js';

export const profileDb = {
  async get(userId) {
    return queryOne(
      `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.locale,
              u.plan_tier, u.plan_status,
              (SELECT count(*)::int FROM study_kits k WHERE k.user_id = u.id AND k.class_id IS NULL) AS kits,
              (SELECT count(*)::int FROM flashcard_reviews fr WHERE fr.user_id = u.id AND fr.last_reviewed_at IS NOT NULL) AS cards,
              COALESCE((SELECT round(avg(utm.mastery_percent))::int FROM user_topic_mastery utm WHERE utm.user_id = u.id), 0) AS mastery,
              COALESCE((SELECT jsonb_agg(days.day ORDER BY days.day) FROM (
                SELECT DISTINCT (ps.completed_at AT TIME ZONE 'UTC')::date AS day
                  FROM practice_sessions ps WHERE ps.user_id = u.id
                    AND ps.completed_at >= date_trunc('week', now() AT TIME ZONE 'UTC')
              ) days), '[]'::jsonb) AS activity_days
         FROM users u WHERE u.id = $1 AND u.status <> 'deleted'`, [userId],
    );
  },
  async update(userId, patch) {
    return queryOne(
      `UPDATE users SET full_name = COALESCE($2, full_name), locale = COALESCE($3, locale)
        WHERE id = $1 AND status <> 'deleted' RETURNING id`,
      [userId, patch.fullName ?? null, patch.locale ?? null],
    );
  },
  async deleteAccount(userId) {
    const userDir = join(uploadRoot, userId);
    await rm(userDir, { recursive: true, force: true });

    const row = await queryOne(
      `DELETE FROM users
        WHERE id = $1 AND status <> 'deleted'
        RETURNING id`,
      [userId],
    );

    return row;
  },
};

