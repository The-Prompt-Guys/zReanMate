import { getAI } from '../ai/index.js';
import { studyGuideDb } from '../db/studyGuide.db.js';
import { summariesDb } from '../db/summaries.db.js';
import { sourcesDb } from '../db/sources.db.js';
import { jobQueue } from '../jobs/queue.js';
import { ApiError } from '../middleware/errors.js';
import { summaryCacheKey } from './summaries.service.js';
import { trackGeneration } from './aiUsage.service.js';

/**
 * Bumped whenever the guide's prompts or section structure change.
 *
 * It rides in the cache params, so it is part of the cache key: a guide written
 * under an older prompt no longer matches and is regenerated the next time the
 * screen asks for it. Without this a student who already has a guide keeps the
 * old wording forever — the document has not changed, so nothing else in the
 * key would differ.
 *
 * 2: modules teach in four named sections and are written to be skimmed —
 *    3-5 core-principle bullets, one worked example, two pitfalls plus an exam
 *    tip, and every recall answer written out in full.
 */
const GUIDE_PROMPT_VERSION = 2;

/**
 * The Study Guide: one document, taught as modules.
 *
 * Single-file isolation is the point of this service and it is enforced here,
 * not in the prompt: `requireSource` resolves exactly one `kit_sources` row,
 * and `source.extracted_text` is the only material that reaches the model. No
 * sibling file in the same kit — and no parent kit, folder or class — is ever
 * read, so a guide cannot drift into material the student did not open.
 *
 * Generation mirrors chaptered summaries: outline once, then one call per
 * module, each claimed separately so a failure costs one module rather than
 * the guide. See summaries.service.js for the cache and queue mechanics.
 */

// Polling screens ask repeatedly; this keeps one process from queueing the
// same guide twice. It starts empty after a restart on purpose, which is what
// lets a persisted `generating` cache be picked up and finished.
const activeCaches = new Set();
const enqueueOnce = (type, payload) => {
  if (activeCaches.has(payload.cacheId)) return;
  activeCaches.add(payload.cacheId);
  jobQueue.enqueue(type, payload);
};

const requireSource = async (userId, sourceId) => {
  const source = await sourcesDb.findAccessibleById({ userId, sourceId });
  if (!source) throw ApiError.notFound('That source does not exist');
  if (source.status !== 'ready' || !source.extracted_text) {
    throw ApiError.conflict('That material is not ready to study', { status: source.status });
  }
  return source;
};

/**
 * Section labels are NOT here. The client writes them from its own
 * dictionaries, so a Khmer guide is Khmer down to the headings — this shape
 * carries content only.
 */
const moduleApi = (row) => ({
  index: row.position,
  title: row.title,
  explanationMd: row.explanation_md,
  applicationMd: row.application_md,
  pitfallsMd: row.pitfalls_md,
  recall: row.recall ?? [],
  status: row.status,
  updatedAt: row.updated_at,
});

const snapshot = async (cache, source) => {
  const current = await summariesDb.findCache(cache.id);
  const modules = await studyGuideDb.listModules(cache.id);
  return {
    status: current.status,
    source: { id: source.id, kitId: source.study_kit_id, name: source.name, kind: source.kind },
    modules: modules.map(moduleApi),
  };
};

const runStudyGuide = async ({ cacheId, sourceId, language, moduleCount }) => {
  try {
    const claimed = await summariesDb.claimCache(cacheId);
    if (!claimed) return;
    const source = await sourcesDb.findByIdUnscoped(sourceId);
    const ai = getAI();

    let outline = claimed.outline;
    if (!outline) {
      const planned = await trackGeneration(
        {
          kind: 'summary',
          userId: source.user_id,
          studyKitId: source.study_kit_id,
          sourceId,
          language,
          sourceText: source.extracted_text,
          request: { method: 'generateStudyGuide', phase: 'outline', moduleCount, serviceTier: 'batch' },
          describe: (value) => ({ modules: value.outline?.length ?? 0 }),
        },
        ({ onUsage }) =>
          ai.generateStudyGuide({
            text: source.extracted_text,
            title: source.name,
            language,
            moduleCount,
            only: [],
            serviceTier: 'batch',
            onUsage,
          }),
      );
      outline = planned.outline;
      await studyGuideDb.saveOutline({ cacheId, source, outline, language });
    }

    const generateModule = async (row) => {
      const claim = await studyGuideDb.claimModule(cacheId, row.position);
      if (!claim) return;
      try {
        const generated = await trackGeneration(
          {
            kind: 'summary',
            userId: source.user_id,
            studyKitId: source.study_kit_id,
            sourceId,
            language,
            sourceText: source.extracted_text,
            request: {
              method: 'generateStudyGuide',
              phase: 'module',
              moduleIndex: row.position,
              serviceTier: 'batch',
            },
            describe: (value) => ({
              bodyChars:
                (value.modules?.[0]?.explanationMd?.length ?? 0) +
                (value.modules?.[0]?.applicationMd?.length ?? 0) +
                (value.modules?.[0]?.pitfallsMd?.length ?? 0),
              recall: value.modules?.[0]?.recall?.length ?? 0,
            }),
          },
          ({ onUsage }) =>
            ai.generateStudyGuide({
              text: source.extracted_text,
              title: source.name,
              language,
              outline,
              only: [row.position],
              serviceTier: 'batch',
              onUsage,
            }),
        );
        await studyGuideDb.saveModule({ cacheId, module: generated.modules[0], model: ai.name });
      } catch (error) {
        await studyGuideDb.failModule(cacheId, row.position);
      }
    };

    const rows = (await studyGuideDb.listModules(cacheId)).filter((item) => item.status !== 'ready');
    // Four concurrent calls shorten the guide's dominant phase while leaving
    // headroom for provider rate limits and database connections.
    for (let index = 0; index < rows.length; index += 4) {
      await Promise.all(rows.slice(index, index + 4).map(generateModule));
    }
    await studyGuideDb.finish(cacheId);
  } catch (error) {
    await summariesDb.failCache(cacheId, error.message);
  } finally {
    activeCaches.delete(cacheId);
  }
};

jobQueue.register('studyGuide.generate', runStudyGuide);

export const studyGuideService = {
  /**
   * Runs the guide inline and waits, for ingest to call once a source is
   * extracted — so opening the Study Guide is a cache read rather than a wait
   * on the model. Reuses a ready cache and lets `claimCache` step aside if a
   * screen asked for the same guide first.
   */
  async prewarm(sourceId, { language, moduleCount = 8 }) {
    const key = summaryCacheKey({
      sourceId,
      method: 'generateStudyGuide',
      params: { language, moduleCount, promptVersion: GUIDE_PROMPT_VERSION },
    });
    const cache = await summariesDb.getOrCreateCache(key);
    if (cache.status === 'ready') return;
    await runStudyGuide({ cacheId: cache.id, sourceId, language, moduleCount });
  },

  async generate(userId, sourceId, input) {
    const source = await requireSource(userId, sourceId);
    const params = {
      language: input.language,
      moduleCount: input.moduleCount,
      promptVersion: GUIDE_PROMPT_VERSION,
    };
    const key = summaryCacheKey({ sourceId, method: 'generateStudyGuide', params });
    const cache = await summariesDb.getOrCreateCache(key);
    if (cache.status !== 'ready') {
      // `params` minus the version, which keys the cache but means nothing to
      // the generator itself.
      enqueueOnce('studyGuide.generate', {
        cacheId: cache.id,
        sourceId,
        language: input.language,
        moduleCount: input.moduleCount,
      });
    }
    return snapshot(cache, source);
  },
};
