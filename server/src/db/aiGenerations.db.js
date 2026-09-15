import { query } from './pool.js';

/**
 * SQL for `ai_generations` — the per-call cost ledger.
 *
 * One row per logical generation: a summary, a quiz, a tutor turn. When a
 * generation fans out into several API requests (summarizeChapters writes one
 * chapter per request) the token counts are summed and `api_calls` records how
 * many requests that sum covers.
 *
 * This table is written for cost analysis, never read on a user's critical
 * path, so `record` swallows its own failures — see the note there.
 */

export const aiGenerationsDb = {
  /**
   * Insert one generation record.
   *
   * @param {Object} params
   * @param {string|null} params.userId
   * @param {string|null} params.studyKitId
   * @param {string|null} params.sourceId
   * @param {'summary'|'quiz'|'flashcards'|'tutor'|'takeaways'|'embedding'} params.kind
   * @param {'openai'|'anthropic'|'mock'} params.provider
   * @param {string|null} params.model
   * @param {Object} params.request   Prompt-shaping inputs, not the prompt text.
   * @param {Object} params.response  Result shape counts, not the content.
   * @param {'ok'|'failed'} params.status
   * @param {string|null} params.errorMessage
   * @param {number|null} params.latencyMs
   * @param {Object} params.usage     A TokenUsage total from createUsageCollector().
   * @param {'km'|'en'|null} params.language
   * @param {number|null} params.sourceChars
   */
  async insert({
    userId = null,
    studyKitId = null,
    sourceId = null,
    kind,
    provider,
    model = null,
    request = {},
    response = {},
    status = 'ok',
    errorMessage = null,
    latencyMs = null,
    usage = {},
    language = null,
    sourceChars = null,
  }) {
    const { rows } = await query(
      `INSERT INTO ai_generations (
         user_id, study_kit_id, source_id, kind, provider, model,
         request, response, status, error_message, latency_ms,
         prompt_tokens, completion_tokens, reasoning_tokens,
         cached_prompt_tokens, total_tokens, language, source_chars, api_calls
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING id, created_at`,
      [
        userId,
        studyKitId,
        sourceId,
        kind,
        provider,
        model,
        JSON.stringify(request ?? {}),
        JSON.stringify(response ?? {}),
        status,
        errorMessage,
        latencyMs,
        usage.promptTokens ?? null,
        usage.completionTokens ?? null,
        usage.reasoningTokens ?? null,
        usage.cachedPromptTokens ?? null,
        usage.totalTokens ?? null,
        language,
        sourceChars,
        // The column is NOT NULL: a generation that reported no usage still
        // made at least one request, so floor at 1 rather than writing 0.
        Math.max(1, usage.apiCalls ?? 1),
      ],
    );

    return rows[0];
  },

  /**
   * The Khmer-versus-English comparison CLAUDE.md asks for, over a window.
   *
   * This aggregates the base table rather than selecting from ai_token_ratios:
   * the view has no time dimension, so filtering it by "a recent row exists"
   * would return all-time totals under a window's heading. The filters are kept
   * identical to the view's so the two agree when the window covers everything.
   *
   * @param {Object} params
   * @param {number} [params.sinceDays=7]
   */
  async tokenRatios({ sinceDays = 7 } = {}) {
    const { rows } = await query(
      `SELECT language,
              kind,
              model,
              count(*)                                AS generations,
              sum(api_calls)                          AS api_calls,
              sum(prompt_tokens)                      AS prompt_tokens,
              sum(completion_tokens)                  AS completion_tokens,
              sum(source_chars)                       AS source_chars,
              round(avg(prompt_tokens)::numeric, 1)   AS avg_prompt_tokens,
              round(sum(prompt_tokens)::numeric
                    / NULLIF(sum(source_chars), 0), 4) AS prompt_tokens_per_char
         FROM ai_generations
        WHERE status = 'ok'
          AND provider <> 'mock'
          AND language IS NOT NULL
          AND created_at >= now() - make_interval(days => $1)
        GROUP BY language, kind, model
        ORDER BY kind, language`,
      [sinceDays],
    );

    return rows;
  },
};
