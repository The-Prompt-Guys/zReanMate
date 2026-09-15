import { getAI } from '../ai/index.js';
import { createUsageCollector } from '../ai/types.js';
import { aiGenerationsDb } from '../db/aiGenerations.db.js';

/**
 * Writes the per-call cost ledger in `ai_generations`.
 *
 * CLAUDE.md wants real token counts behind the Khmer-versus-English cost
 * question before an OpenAI key is trusted with production traffic. Nothing was
 * recording them, so this is the one place that does.
 *
 * Two rules shape everything here:
 *
 * 1. Telemetry never breaks a generation. Every write is wrapped — a failed
 *    INSERT costs a log line, not a student's summary.
 * 2. Content is never stored. `request` holds the knobs that shaped the call
 *    (count, difficulty, language) and `response` holds shape counts. The
 *    prompt text and the generated text stay in their own tables, so this one
 *    can be queried, exported, and kept without dragging study material along.
 */

/**
 * Which cost bucket a piece of source text falls into.
 *
 * Only for callers that have no declared language — ingest embeds a document
 * before anyone has chosen a study language, and an embedding row with a null
 * language is invisible to the very comparison this table exists for.
 *
 * This is cost bucketing, not language detection. A byte-pair tokenizer has no
 * Khmer vocabulary, so any substantial run of Khmer makes the text expensive
 * regardless of what else it contains; the threshold is deliberately low.
 */
const KHMER_BLOCK = /[ក-៿]/g;

export const detectCostLanguage = (text) => {
  const value = String(text ?? '');
  if (!value) return null;
  const khmerChars = (value.match(KHMER_BLOCK) ?? []).length;
  return khmerChars / value.length > 0.1 ? 'km' : 'en';
};

/** Best-effort insert. Returns the row on success, null when logging failed. */
const write = async (row) => {
  try {
    return await aiGenerationsDb.insert(row);
  } catch (err) {
    console.warn(`[ai] could not record ${row.kind} generation: ${err.message}`);
    return null;
  }
};

/**
 * Runs one AI call and records what it cost.
 *
 * `run` receives `{ ai, onUsage }` and must pass `onUsage` into the provider
 * method — that callback is how tokens get reported (see types.js,
 * UsageReporter). A failed call is logged too, at status 'failed', because a
 * generation that burned tokens and then threw is exactly the expensive case
 * worth seeing.
 *
 * @param {Object} context
 * @param {'summary'|'quiz'|'flashcards'|'tutor'|'takeaways'|'embedding'} context.kind
 * @param {string|null} [context.userId]
 * @param {string|null} [context.studyKitId]
 * @param {string|null} [context.sourceId]
 * @param {'km'|'en'|null} [context.language]
 * @param {string} [context.sourceText]  Measured for length only, never stored.
 * @param {Object} [context.request]     Prompt-shaping inputs.
 * @param {(result: any) => Object} [context.describe]  Result -> shape counts.
 * @param {(args: {ai: Object, onUsage: Function}) => Promise<any>} run
 */
export const trackGeneration = async (
  { kind, userId, studyKitId, sourceId, language = null, sourceText, request = {}, describe },
  run,
) => {
  const ai = getAI();
  const usage = createUsageCollector();
  const startedAt = Date.now();

  const base = {
    userId: userId ?? null,
    studyKitId: studyKitId ?? null,
    sourceId: sourceId ?? null,
    kind,
    provider: ai.name,
    language,
    sourceChars: typeof sourceText === 'string' ? sourceText.length : null,
    request,
  };

  try {
    const result = await run({ ai, onUsage: usage.record });
    const total = usage.total();

    await write({
      ...base,
      model: total.model,
      response: describe ? describe(result) : {},
      status: 'ok',
      latencyMs: Date.now() - startedAt,
      usage: total,
    });

    return result;
  } catch (error) {
    const total = usage.total();

    await write({
      ...base,
      model: total.model,
      response: {},
      status: 'failed',
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt,
      usage: total,
    });

    throw error;
  }
};

/**
 * The streaming counterpart.
 *
 * tutorReply is an async generator, so it cannot be wrapped the way
 * trackGeneration wraps a promise — the caller has to drive the stream itself.
 * It collects usage while iterating and calls this once the terminal chunk has
 * arrived.
 *
 * @param {Object} params
 * @param {Object} params.usageTotal  From createUsageCollector().total().
 * @param {number} params.startedAt   Date.now() from before the stream opened.
 */
export const recordStreamedGeneration = async ({
  kind = 'tutor',
  userId,
  studyKitId,
  sourceId,
  language = null,
  sourceText,
  request = {},
  response = {},
  status = 'ok',
  errorMessage = null,
  usageTotal,
  startedAt,
}) =>
  write({
    userId: userId ?? null,
    studyKitId: studyKitId ?? null,
    sourceId: sourceId ?? null,
    kind,
    provider: getAI().name,
    model: usageTotal?.model ?? null,
    language,
    sourceChars: typeof sourceText === 'string' ? sourceText.length : null,
    request,
    response,
    status,
    errorMessage,
    latencyMs: startedAt ? Date.now() - startedAt : null,
    usage: usageTotal ?? {},
  });

/** Reads the Khmer-versus-English comparison. Mock rows are excluded upstream. */
export const tokenRatios = ({ sinceDays = 7 } = {}) => aiGenerationsDb.tokenRatios({ sinceDays });
