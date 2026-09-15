import { getAI } from '../ai/index.js';
import { flashcardsDb } from '../db/flashcards.db.js';
import { summariesDb } from '../db/summaries.db.js';
import { sourcesDb } from '../db/sources.db.js';
import { jobQueue } from '../jobs/queue.js';
import { ApiError } from '../middleware/errors.js';
import { scheduleSm2Review } from './sm2.js';
import { summaryCacheKey } from './summaries.service.js';
import { plansService } from './plans.service.js';
import { trackGeneration } from './aiUsage.service.js';

const activeCaches = new Set();
const normalize = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('und');

export const validateGeneratedFlashcards = (cards, expectedCount) => {
  if (!Array.isArray(cards) || cards.length !== expectedCount) {
    throw new Error(`generateFlashcards: expected exactly ${expectedCount} cards, got ${cards?.length ?? 'invalid'}`);
  }
  const terms = new Set();
  return cards.map((card, index) => {
    const label = `generateFlashcards: card ${index + 1}`;
    if (!card || typeof card !== 'object') throw new Error(`${label} is invalid`);
    if (typeof card.term !== 'string' || !card.term.trim()) throw new Error(`${label} has an empty term`);
    if (typeof card.definition !== 'string' || !card.definition.trim()) throw new Error(`${label} has an empty definition`);
    const term = card.term.trim();
    const key = normalize(term);
    if (terms.has(key)) throw new Error(`${label} duplicates term "${term}"`);
    terms.add(key);
    return {
      term,
      definition: card.definition.trim(),
      hint: typeof card.hint === 'string' && card.hint.trim() ? card.hint.trim() : null,
      topic: typeof card.topic === 'string' ? card.topic.trim() : '',
    };
  });
};

const cardApi = (row) => ({
  id: row.id, kitId: row.study_kit_id, sourceId: row.source_id,
  term: row.term, definition: row.definition, hint: row.hint, language: row.language,
  position: row.position, easeFactor: row.ease_factor, intervalDays: row.interval_days,
  repetitions: row.repetitions, lapses: row.lapses, dueAt: row.due_at,
  lastReviewedAt: row.last_reviewed_at,
});

const requireSource = async (userId, sourceId) => {
  const source = await sourcesDb.findAccessibleById({ userId, sourceId });
  if (!source) throw ApiError.notFound('That source does not exist');
  if (source.status !== 'ready' || !source.extracted_text) {
    throw ApiError.conflict('That source is not ready for flashcards');
  }
  return source;
};

const runGeneration = async ({ cacheId, sourceId, params }) => {
  try {
    if (!await summariesDb.claimCache(cacheId)) return;
    const source = await sourcesDb.findByIdUnscoped(sourceId);
    const ai = getAI();
    const raw = await trackGeneration(
      {
        kind: 'flashcards',
        userId: source.user_id,
        studyKitId: source.study_kit_id,
        sourceId,
        language: params.language,
        sourceText: source.extracted_text,
        request: { count: params.count, reasoningEffort: 'none' },
        describe: (value) => ({ cards: Array.isArray(value) ? value.length : 0 }),
      },
      ({ onUsage }) =>
        ai.generateFlashcards({
          text: source.extracted_text, language: params.language, count: params.count,
          reasoningEffort: 'none', onUsage,
        }),
    );
    const cards = validateGeneratedFlashcards(raw, params.count);
    await flashcardsDb.saveGenerated({ cacheId, source, cards, language: params.language });
  } catch (error) {
    await summariesDb.failCache(cacheId, error.message);
  } finally {
    activeCaches.delete(cacheId);
  }
};
jobQueue.register('flashcards.generate', runGeneration);

const snapshot = async (cache, userId) => {
  const current = await summariesDb.findCache(cache.id);
  const cards = current.status === 'ready' ? await flashcardsDb.byCache(cache.id, userId) : [];
  return {
    cache: { sourceId: current.source_id, method: current.method, params: current.params, paramsHash: current.params_hash },
    status: current.status,
    cards: cards.map(cardApi),
    ...(current.status === 'failed' && { error: current.error_message }),
  };
};

export const flashcardsService = {
  async generate(userId, _plan, sourceId, input) {
    await requireSource(userId, sourceId);
    const params = { count: await plansService.generationCount(userId, 'flashcards'), language: input.language };
    const cache = await summariesDb.getOrCreateCache(summaryCacheKey({
      sourceId, method: 'generateFlashcards', params,
    }));
    if (cache.status !== 'ready' && !activeCaches.has(cache.id)) {
      activeCaches.add(cache.id);
      jobQueue.enqueue('flashcards.generate', { cacheId: cache.id, sourceId, params });
    }
    return snapshot(cache, userId);
  },

  async due(userId, input) {
    const rows = await flashcardsDb.due({ userId, limit: input.limit, kitId: input.kitId });
    return { cards: rows.map(cardApi) };
  },

  async review(userId, flashcardId, quality) {
    const row = await flashcardsDb.review({
      userId, flashcardId, quality, reviewedAt: new Date(), calculate: scheduleSm2Review,
    });
    if (!row) throw ApiError.notFound('That flashcard does not exist');
    return {
      nextDueAt: row.due_at,
      review: {
        flashcardId: row.flashcard_id, quality: row.quality,
        easeFactor: Number(row.ease_factor), intervalDays: row.interval_days,
        repetitions: row.repetitions, lapses: row.lapses,
        dueAt: row.due_at, lastReviewedAt: row.last_reviewed_at,
      },
    };
  },
};
