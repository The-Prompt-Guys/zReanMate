import { query, queryOne, withTransaction } from './pool.js';

const CARD_SELECT = `
  SELECT f.id, f.study_kit_id, f.source_id, f.term, f.definition, f.hint,
         f.language, f.position, f.generated_by_ai,
         COALESCE(r.ease_factor, 2.50)::float AS ease_factor,
         COALESCE(r.interval_days, 0)::int AS interval_days,
         COALESCE(r.repetitions, 0)::int AS repetitions,
         COALESCE(r.lapses, 0)::int AS lapses,
         COALESCE(r.due_at, f.created_at) AS due_at,
         r.last_reviewed_at`;

export const flashcardsDb = {
  async saveGenerated({ cacheId, source, cards, language }) {
    return withTransaction(async (client) => {
      for (const [position, card] of cards.entries()) {
        let topicId = null;
        if (card.topic) {
          topicId = (await client.query(
            `INSERT INTO topics (study_kit_id, name) VALUES ($1, $2)
             ON CONFLICT (study_kit_id, name) WHERE study_kit_id IS NOT NULL
             DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [source.study_kit_id, card.topic],
          )).rows[0].id;
        }
        await client.query(
          `INSERT INTO flashcards
             (study_kit_id, user_id, source_id, topic_id, generation_cache_id,
              term, definition, hint, language, position, generated_by_ai)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
           ON CONFLICT (generation_cache_id, position) WHERE generation_cache_id IS NOT NULL
           DO NOTHING`,
          [source.study_kit_id, source.user_id, source.id, topicId, cacheId,
            card.term, card.definition, card.hint, language, position],
        );
      }
      await client.query(
        `UPDATE ai_generation_cache SET status = 'ready', error_message = NULL WHERE id = $1`,
        [cacheId],
      );
    });
  },

  async byCache(cacheId, userId) {
    const { rows } = await query(
      `${CARD_SELECT}
         FROM flashcards f
         LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = $2
        WHERE f.generation_cache_id = $1 ORDER BY f.position`,
      [cacheId, userId],
    );
    return rows;
  },

  async due({ userId, limit, kitId, sourceId = null }) {
    const { rows } = await query(
      `${CARD_SELECT}
         FROM flashcards f
         JOIN study_kits k ON k.id = f.study_kit_id
         LEFT JOIN flashcard_reviews r ON r.flashcard_id = f.id AND r.user_id = $1
        WHERE (k.user_id = $1 OR EXISTS (
            SELECT 1 FROM class_enrollments ce
             WHERE ce.class_id = k.class_id AND ce.user_id = $1 AND ce.status = 'active'
          ))
          AND ($3::uuid IS NULL OR f.study_kit_id = $3)
          AND ($4::uuid IS NULL OR f.source_id = $4)
          AND COALESCE(r.due_at, f.created_at) <= now()
        ORDER BY COALESCE(r.due_at, f.created_at), f.position
        LIMIT $2`,
      [userId, limit, kitId ?? null, sourceId],
    );
    return rows;
  },

  async review({ userId, flashcardId, quality, reviewedAt, calculate }) {
    return withTransaction(async (client) => {
      const card = (await client.query(
        `SELECT f.id FROM flashcards f JOIN study_kits k ON k.id = f.study_kit_id
          WHERE f.id = $1 AND (k.user_id = $2 OR EXISTS (
            SELECT 1 FROM class_enrollments ce
             WHERE ce.class_id = k.class_id AND ce.user_id = $2 AND ce.status = 'active'
          ))`,
        [flashcardId, userId],
      )).rows[0];
      if (!card) return null;

      const current = (await client.query(
        `SELECT ease_factor::float, interval_days, repetitions, lapses
           FROM flashcard_reviews WHERE user_id = $1 AND flashcard_id = $2 FOR UPDATE`,
        [userId, flashcardId],
      )).rows[0];
      const next = calculate(current && {
        easeFactor: current.ease_factor,
        intervalDays: current.interval_days,
        repetitions: current.repetitions,
        lapses: current.lapses,
      }, quality, reviewedAt);

      return (await client.query(
        `INSERT INTO flashcard_reviews
           (user_id, flashcard_id, quality, ease_factor, interval_days,
            repetitions, lapses, due_at, last_reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, flashcard_id) DO UPDATE SET
           quality = EXCLUDED.quality, ease_factor = EXCLUDED.ease_factor,
           interval_days = EXCLUDED.interval_days, repetitions = EXCLUDED.repetitions,
           lapses = EXCLUDED.lapses, due_at = EXCLUDED.due_at,
           last_reviewed_at = EXCLUDED.last_reviewed_at
         RETURNING *`,
        [userId, flashcardId, quality, next.easeFactor, next.intervalDays,
          next.repetitions, next.lapses, next.dueAt, next.lastReviewedAt],
      )).rows[0];
    });
  },

  async findCacheCards(cacheId) {
    return queryOne(`SELECT count(*)::int AS count FROM flashcards WHERE generation_cache_id = $1`, [cacheId]);
  },
};
