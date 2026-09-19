import { query, queryOne, withTransaction } from './pool.js';

const CACHE_SELECT = `
  SELECT c.id, c.source_id, c.method, c.params, c.params_hash, c.outline,
         c.status, c.error_message, c.created_at, c.updated_at
    FROM ai_generation_cache c`;

export const summariesDb = {
  async getOrCreateCache({ sourceId, method, params, paramsHash }) {
    return queryOne(
      `INSERT INTO ai_generation_cache (source_id, method, params, params_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_id, method, params_hash) DO UPDATE
         SET params = ai_generation_cache.params
       RETURNING *`,
      [sourceId, method, JSON.stringify(params), paramsHash],
    );
  },

  async findCache(cacheId) {
    return queryOne(`${CACHE_SELECT} WHERE c.id = $1`, [cacheId]);
  },

  async claimCache(cacheId) {
    return queryOne(
      `UPDATE ai_generation_cache
          SET status = 'generating', error_message = NULL
        WHERE id = $1 AND status <> 'ready'
        RETURNING *`,
      [cacheId],
    );
  },

  async saveSummary({ cacheId, source, result, model }) {
    return withTransaction(async (client) => {
      await client.query(
        `INSERT INTO summaries
           (study_kit_id, source_id, generation_cache_id, scope, title, body_md,
            key_points, language, status, model)
         VALUES ($1, $2, $3, 'source', $4, $5, $6, $7, 'ready', $8)
         ON CONFLICT (generation_cache_id, scope, (COALESCE(chapter_index, 0)))
           WHERE generation_cache_id IS NOT NULL
         DO UPDATE SET title = EXCLUDED.title, body_md = EXCLUDED.body_md,
                       key_points = EXCLUDED.key_points, status = 'ready', model = EXCLUDED.model`,
        [source.study_kit_id, source.id, cacheId, result.title, result.bodyMd,
          JSON.stringify(result.keyPoints), result.language, model],
      );
      await client.query(
        `UPDATE ai_generation_cache SET status = 'ready', error_message = NULL WHERE id = $1`,
        [cacheId],
      );
    });
  },

  async saveOutline({ cacheId, source, outline, language }) {
    return withTransaction(async (client) => {
      await client.query(`UPDATE ai_generation_cache SET outline = $2 WHERE id = $1`, [cacheId, JSON.stringify(outline)]);
      for (const chapter of outline) {
        await client.query(
          `INSERT INTO summaries
             (study_kit_id, source_id, generation_cache_id, scope, chapter_index,
              title, language, start_seconds, end_seconds, status)
           VALUES ($1, $2, $3, 'chapter', $4, $5, $6, $7, $8, 'pending')
           ON CONFLICT (generation_cache_id, scope, (COALESCE(chapter_index, 0)))
             WHERE generation_cache_id IS NOT NULL DO NOTHING`,
          [source.study_kit_id, source.id, cacheId, chapter.chapterIndex, chapter.title,
            language, chapter.startSeconds, chapter.endSeconds],
        );
      }
    });
  },

  async listChapters(cacheId) {
    const { rows } = await query(
      `SELECT id, chapter_index, title, body_md, key_points, language,
              start_seconds, end_seconds, status, updated_at
         FROM summaries
        WHERE generation_cache_id = $1 AND scope = 'chapter'
        ORDER BY chapter_index`,
      [cacheId],
    );
    return rows;
  },

  async getSummary(cacheId) {
    return queryOne(
      `SELECT id, title, body_md, key_points, language, status, updated_at
         FROM summaries WHERE generation_cache_id = $1 AND scope = 'source'`,
      [cacheId],
    );
  },

  async claimChapter(cacheId, chapterIndex) {
    return queryOne(
      `UPDATE summaries SET status = 'generating'
        WHERE generation_cache_id = $1 AND scope = 'chapter' AND chapter_index = $2
          AND status IN ('pending', 'failed')
        RETURNING id`,
      [cacheId, chapterIndex],
    );
  },

  async saveChapter({ cacheId, chapter, model }) {
    await query(
      `UPDATE summaries SET body_md = $3, key_points = $4, status = 'ready', model = $5
        WHERE generation_cache_id = $1 AND scope = 'chapter' AND chapter_index = $2`,
      [cacheId, chapter.chapterIndex, chapter.bodyMd, JSON.stringify(chapter.keyPoints), model],
    );
  },

  async failChapter(cacheId, chapterIndex) {
    await query(
      `UPDATE summaries SET status = 'failed'
        WHERE generation_cache_id = $1 AND scope = 'chapter' AND chapter_index = $2`,
      [cacheId, chapterIndex],
    );
  },

  async finishChapters(cacheId) {
    await query(
      `UPDATE ai_generation_cache c
          SET status = CASE
            WHEN NOT EXISTS (SELECT 1 FROM summaries s WHERE s.generation_cache_id = c.id AND s.status <> 'ready')
              THEN 'ready'
            WHEN EXISTS (SELECT 1 FROM summaries s WHERE s.generation_cache_id = c.id AND s.status = 'failed')
              THEN 'failed'
            ELSE 'generating' END
        WHERE c.id = $1`,
      [cacheId],
    );
  },

  async failCache(cacheId, message) {
    await query(`UPDATE ai_generation_cache SET status = 'failed', error_message = $2 WHERE id = $1`, [cacheId, String(message).slice(0, 2000)]);
  },
};
