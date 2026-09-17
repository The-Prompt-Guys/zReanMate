import { query, queryOne, withTransaction } from './pool.js';

/**
 * Study guide modules.
 *
 * Shares `ai_generation_cache` with summaries — `summariesDb` owns the cache
 * row itself (create, claim, fail), and this module owns only the rows that
 * hang off it. Two db modules writing the same table would be worse than the
 * small import that avoids it.
 */
export const studyGuideDb = {
  /**
   * One row per module, all 'pending'. Written once, from the outline pass.
   *
   * DO NOTHING on conflict rather than overwriting: a resumed run passes the
   * same outline back, and a module whose body is already written must not be
   * reset to pending and regenerated.
   */
  async saveOutline({ cacheId, source, outline, language }) {
    return withTransaction(async (client) => {
      await client.query(`UPDATE ai_generation_cache SET outline = $2 WHERE id = $1`, [
        cacheId,
        JSON.stringify(outline),
      ]);
      for (const module of outline) {
        await client.query(
          `INSERT INTO study_guide_modules
             (study_kit_id, source_id, generation_cache_id, position, title, language, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')
           ON CONFLICT (generation_cache_id, position) DO NOTHING`,
          [source.study_kit_id, source.id, cacheId, module.moduleIndex, module.title, language],
        );
      }
    });
  },

  async listModules(cacheId) {
    const { rows } = await query(
      `SELECT id, position, title, explanation_md, application_md, pitfalls_md,
              recall, language, status, updated_at
         FROM study_guide_modules
        WHERE generation_cache_id = $1
        ORDER BY position`,
      [cacheId],
    );
    return rows;
  },

  /**
   * Takes ownership of one module before generating it, so two pollers cannot
   * pay for the same module twice. Returns nothing when another worker already
   * holds it, or when it is already written.
   */
  async claimModule(cacheId, position) {
    return queryOne(
      `UPDATE study_guide_modules SET status = 'generating'
        WHERE generation_cache_id = $1 AND position = $2 AND status IN ('pending', 'failed')
        RETURNING id`,
      [cacheId, position],
    );
  },

  async saveModule({ cacheId, module, model }) {
    await query(
      `UPDATE study_guide_modules
          SET title = $3, explanation_md = $4, application_md = $5, pitfalls_md = $6,
              recall = $7, status = 'ready', model = $8
        WHERE generation_cache_id = $1 AND position = $2`,
      [
        cacheId,
        module.moduleIndex,
        module.title,
        module.explanationMd,
        module.applicationMd,
        module.pitfallsMd,
        JSON.stringify(module.recall ?? []),
        model,
      ],
    );
  },

  async failModule(cacheId, position) {
    await query(
      `UPDATE study_guide_modules SET status = 'failed'
        WHERE generation_cache_id = $1 AND position = $2`,
      [cacheId, position],
    );
  },

  /**
   * The cache is ready only when every module is. A guide with one failed
   * module stays 'failed' so the screen can offer a retry, while the modules
   * that did generate stay readable.
   */
  async finish(cacheId) {
    await query(
      `UPDATE ai_generation_cache c
          SET status = CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM study_guide_modules m
               WHERE m.generation_cache_id = c.id AND m.status <> 'ready') THEN 'ready'
            WHEN EXISTS (
              SELECT 1 FROM study_guide_modules m
               WHERE m.generation_cache_id = c.id AND m.status = 'failed') THEN 'failed'
            ELSE 'generating' END
        WHERE c.id = $1`,
      [cacheId],
    );
  },
};
