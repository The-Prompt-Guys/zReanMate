import { createHash } from 'node:crypto';

import { getAI } from '../ai/index.js';
import { summariesDb } from '../db/summaries.db.js';
import { sourcesDb } from '../db/sources.db.js';
import { jobQueue } from '../jobs/queue.js';
import { ApiError } from '../middleware/errors.js';
import { plansService } from './plans.service.js';
import { trackGeneration } from './aiUsage.service.js';

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};

// Prevent polling requests from queueing duplicate work in this process. The
// set starts empty after a restart, which intentionally lets a persisted
// `generating` cache be claimed and resumed.
const activeCaches = new Set();
const enqueueOnce = (type, payload) => {
  if (activeCaches.has(payload.cacheId)) return;
  activeCaches.add(payload.cacheId);
  jobQueue.enqueue(type, payload);
};

export const summaryCacheKey = ({ sourceId, method, params }) => {
  const canonicalParams = JSON.stringify(canonicalize(params));
  return {
    sourceId,
    method,
    params: JSON.parse(canonicalParams),
    paramsHash: createHash('sha256').update(canonicalParams).digest('hex'),
  };
};

const requireSource = async (userId, sourceId) => {
  const source = await sourcesDb.findAccessibleById({ userId, sourceId });
  if (!source) throw ApiError.notFound('That source does not exist');
  if (source.status !== 'ready' || !source.extracted_text) {
    throw ApiError.conflict('That source is not ready to summarize', { status: source.status });
  }
  return source;
};

const chapterApi = (row) => ({
  index: row.chapter_index,
  title: row.title,
  bodyMd: row.body_md,
  keyPoints: row.key_points,
  startSeconds: row.start_seconds,
  endSeconds: row.end_seconds,
  status: row.status,
  updatedAt: row.updated_at,
});

const snapshot = async (cache, source) => {
  const current = await summariesDb.findCache(cache.id);
  const result = current.method === 'summarize' ? await summariesDb.getSummary(cache.id) : null;
  const chapters = current.method === 'summarizeChapters' ? await summariesDb.listChapters(cache.id) : [];
  return {
    cache: { sourceId: current.source_id, method: current.method, params: current.params, paramsHash: current.params_hash },
    source: { id: source.id, kitId: source.study_kit_id, name: source.name, kind: source.kind, durationSeconds: source.duration_seconds },
    status: current.status,
    summary: result ? { title: result.title, bodyMd: result.body_md, keyPoints: result.key_points, language: result.language } : null,
    chapters: chapters.map(chapterApi),
  };
};

const runSummary = async ({ cacheId, sourceId, language }) => {
  try {
    const claimed = await summariesDb.claimCache(cacheId);
    if (!claimed) return;
    const source = await sourcesDb.findByIdUnscoped(sourceId);
    const ai = getAI();
    const result = await trackGeneration(
      {
        kind: 'summary',
        userId: source.user_id,
        studyKitId: source.study_kit_id,
        sourceId,
        language,
        sourceText: source.extracted_text,
        request: { method: 'summarize', serviceTier: 'batch' },
        describe: (summary) => ({
          bodyChars: summary.bodyMd?.length ?? 0,
          keyPoints: summary.keyPoints?.length ?? 0,
        }),
      },
      ({ onUsage }) =>
        ai.summarize({ text: source.extracted_text, title: source.name, language, serviceTier: 'batch', onUsage }),
    );
    await summariesDb.saveSummary({ cacheId, source, result: { ...result, language }, model: ai.name });
  } catch (error) {
    await summariesDb.failCache(cacheId, error.message);
  } finally {
    activeCaches.delete(cacheId);
  }
};

const runChapters = async ({ cacheId, sourceId, language, chapterCount }) => {
  try {
    const claimed = await summariesDb.claimCache(cacheId);
    if (!claimed) return;
    const source = await sourcesDb.findByIdUnscoped(sourceId);
    const ai = getAI();
    let outline = claimed.outline;
    if (!outline) {
      const outlined = await trackGeneration(
        {
          kind: 'summary',
          userId: source.user_id,
          studyKitId: source.study_kit_id,
          sourceId,
          language,
          sourceText: source.extracted_text,
          request: { method: 'summarizeChapters', phase: 'outline', chapterCount, serviceTier: 'batch' },
          describe: (value) => ({ chapters: value.outline?.length ?? 0 }),
        },
        ({ onUsage }) =>
          ai.summarizeChapters({ text: source.extracted_text, title: source.name, language, durationSeconds: source.duration_seconds, chapterCount, only: [], serviceTier: 'batch', onUsage }),
      );
      outline = outlined.outline;
      await summariesDb.saveOutline({ cacheId, source, outline, language });
    }

    const rows = await summariesDb.listChapters(cacheId);
    for (const row of rows.filter((item) => item.status !== 'ready')) {
      const bodyClaim = await summariesDb.claimChapter(cacheId, row.chapter_index);
      if (!bodyClaim) continue;
      try {
        const generated = await trackGeneration(
          {
            kind: 'summary',
            userId: source.user_id,
            studyKitId: source.study_kit_id,
            sourceId,
            language,
            sourceText: source.extracted_text,
            request: { method: 'summarizeChapters', phase: 'body', chapterIndex: row.chapter_index, serviceTier: 'batch' },
            describe: (value) => ({ bodyChars: value.chapters?.[0]?.bodyMd?.length ?? 0 }),
          },
          ({ onUsage }) =>
            ai.summarizeChapters({ text: source.extracted_text, title: source.name, language, durationSeconds: source.duration_seconds, outline, only: [row.chapter_index], serviceTier: 'batch', onUsage }),
        );
        await summariesDb.saveChapter({ cacheId, chapter: generated.chapters[0], model: ai.name });
      } catch (error) {
        await summariesDb.failChapter(cacheId, row.chapter_index);
      }
    }
    await summariesDb.finishChapters(cacheId);
  } catch (error) {
    await summariesDb.failCache(cacheId, error.message);
  } finally {
    activeCaches.delete(cacheId);
  }
};

jobQueue.register('summary.generate', runSummary);
jobQueue.register('chapters.generate', runChapters);

/**
 * `prewarm` runs a generation inline and waits for it, where `generate` creates
 * the cache row and hands the work to the queue for a polling screen to collect.
 *
 * Ingest uses it so that a source only reaches `ready` once its materials
 * actually exist — opening the Study Guide after that is a cache read, not a
 * fresh call to the model. It reuses a ready cache and relies on `claimCache`
 * to step aside if a screen happened to ask for the same thing first.
 */
export const summariesService = {
  async prewarm(sourceId, { language }) {
    const key = summaryCacheKey({ sourceId, method: 'summarize', params: { language } });
    const cache = await summariesDb.getOrCreateCache(key);
    if (cache.status === 'ready') return;
    await runSummary({ cacheId: cache.id, sourceId, language });
  },

  async summarize(userId, sourceId, input) {
    const source = await requireSource(userId, sourceId);
    const key = summaryCacheKey({ sourceId, method: 'summarize', params: { language: input.language } });
    const cache = await summariesDb.getOrCreateCache(key);
    if (cache.status !== 'ready') enqueueOnce('summary.generate', { cacheId: cache.id, sourceId, language: input.language });
    return snapshot(cache, source);
  },

  async chapters(userId, sourceId, input) {
    await plansService.requireFeature(userId, 'chapter_summaries');
    const source = await requireSource(userId, sourceId);
    const params = { chapterCount: input.chapterCount, language: input.language };
    const key = summaryCacheKey({ sourceId, method: 'summarizeChapters', params });
    const cache = await summariesDb.getOrCreateCache(key);
    if (cache.status !== 'ready') enqueueOnce('chapters.generate', { cacheId: cache.id, sourceId, ...params });
    return snapshot(cache, source);
  },
};
