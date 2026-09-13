import { queryOne } from './pool.js';

/**
 * SQL for `onboarding_responses`. One row per user, answers held as JSONB so
 * the question set can change without a migration.
 */
export const onboardingDb = {
  /**
   * Upsert, merging into any existing answers rather than replacing them — the
   * survey is three separate screens and each can submit on its own, so a
   * partial submission must not wipe earlier steps.
   */
  async saveAnswers({ userId, answers, skipped = false, surveyVersion = 1, completed = false }) {
    return queryOne(
      `INSERT INTO onboarding_responses (user_id, survey_version, answers, skipped, completed_at)
       VALUES ($1, $2, $3::jsonb, $4, CASE WHEN $5 THEN now() ELSE NULL END)
       ON CONFLICT (user_id) DO UPDATE
         SET answers        = onboarding_responses.answers || EXCLUDED.answers,
             skipped        = EXCLUDED.skipped,
             survey_version = EXCLUDED.survey_version,
             completed_at   = COALESCE(onboarding_responses.completed_at, EXCLUDED.completed_at)
       RETURNING id, user_id, survey_version, answers, skipped, completed_at, updated_at`,
      [userId, surveyVersion, JSON.stringify(answers ?? {}), skipped, completed],
    );
  },

  async findByUserId(userId) {
    return queryOne(
      `SELECT id, user_id, survey_version, answers, skipped, completed_at, created_at, updated_at
         FROM onboarding_responses
        WHERE user_id = $1`,
      [userId],
    );
  },
};
