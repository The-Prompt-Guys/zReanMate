import { getAI } from '../ai/index.js';
import { mockExamDb } from '../db/mockExam.db.js';
import { summariesDb } from '../db/summaries.db.js';
import { sourcesDb } from '../db/sources.db.js';
import { jobQueue } from '../jobs/queue.js';
import { balanceAnswerPositions } from './quiz.service.js';
import { summaryCacheKey } from './summaries.service.js';
import { detectCostLanguage, trackGeneration } from './aiUsage.service.js';

/**
 * How many questions a bank holds.
 *
 * Bigger than the largest sitting the setup screen offers (20), so a draw
 * cannot run short — running short is what produced "Not enough generated
 * questions for those settings" when a student picked 20 against a 10-question
 * quiz. The surplus also means two exams on the same material are not the same
 * exam.
 */
const BANK_SIZE = 30;

const activeCaches = new Set();

/**
 * Validates what the model returned before any of it is stored.
 *
 * Deliberately stricter than "did the JSON parse". Strict json_schema
 * guarantees the fields exist and have the right types; it cannot guarantee
 * that `expectedAnswer` says anything, that a choice question has four distinct
 * options, or that `correctAnswer` points inside the options array. Each of
 * those produces a question a student cannot answer correctly, and finding out
 * at exam time is too late.
 */
export const validateGeneratedExam = (exam, expectedCount) => {
  if (!exam || typeof exam !== 'object' || typeof exam.title !== 'string' || !exam.title.trim()) {
    throw new Error('generateMockExam: exam title must be non-empty');
  }
  if (!Array.isArray(exam.questions) || exam.questions.length !== expectedCount) {
    throw new Error(
      `generateMockExam: expected exactly ${expectedCount} questions, got ${exam.questions?.length ?? 'invalid'}`,
    );
  }

  const kinds = new Set(['multiple_choice', 'true_false', 'short_answer', 'written']);
  const difficulties = new Set(['easy', 'medium', 'hard']);

  const questions = exam.questions.map((question, index) => {
    const label = `generateMockExam: question ${index + 1}`;
    if (!question || typeof question !== 'object' || !kinds.has(question.kind)) {
      throw new Error(`${label} has an unsupported kind`);
    }
    if (typeof question.prompt !== 'string' || !question.prompt.trim()) {
      throw new Error(`${label} has an empty prompt`);
    }
    if (typeof question.explanation !== 'string' || !question.explanation.trim()) {
      throw new Error(`${label} has an empty explanation`);
    }
    // The whole point of the separate method: a written answer is marked
    // against this, so an empty one marks every response wrong.
    if (typeof question.expectedAnswer !== 'string' || !question.expectedAnswer.trim()) {
      throw new Error(`${label} has no expectedAnswer to mark a written response against`);
    }
    if (!difficulties.has(question.difficulty)) {
      throw new Error(`${label} has an unknown difficulty`);
    }
    if (!Array.isArray(question.options)) throw new Error(`${label} options must be an array`);

    const isChoice = question.kind === 'multiple_choice' || question.kind === 'true_false';
    const requiredOptions = question.kind === 'multiple_choice' ? 4 : 2;
    if (isChoice && question.options.length !== requiredOptions) {
      throw new Error(`${label} requires exactly ${requiredOptions} options`);
    }
    if (!isChoice && question.options.length !== 0) {
      throw new Error(`${label} must not have choice options`);
    }
    if (question.options.some((option) => typeof option !== 'string' || !option.trim())) {
      throw new Error(`${label} has an empty option`);
    }
    // Two options that read the same make one of them unanswerable.
    const normalized = question.options.map((option) =>
      option.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('und'));
    if (new Set(normalized).size !== normalized.length) {
      throw new Error(`${label} has duplicate options`);
    }
    if (isChoice && (!Number.isInteger(question.correctAnswer)
      || question.correctAnswer < 0 || question.correctAnswer >= question.options.length)) {
      throw new Error(`${label} correct index is out of range`);
    }
    if (!isChoice && (typeof question.correctAnswer !== 'string' || !question.correctAnswer.trim())) {
      throw new Error(`${label} needs a non-empty written answer`);
    }

    return {
      ...question,
      prompt: question.prompt.trim(),
      options: question.options.map((option) => option.trim()),
      expectedAnswer: question.expectedAnswer.trim(),
      explanation: question.explanation.trim(),
      correctAnswer: typeof question.correctAnswer === 'string'
        ? question.correctAnswer.trim() : question.correctAnswer,
      topic: typeof question.topic === 'string' ? question.topic.trim() : '',
    };
  });

  return { title: exam.title.trim(), questions };
};

const runGeneration = async ({ cacheId, sourceId, params }) => {
  try {
    const claimed = await summariesDb.claimCache(cacheId);
    if (!claimed) return;
    const source = await sourcesDb.findByIdUnscoped(sourceId);
    const ai = getAI();

    const raw = await trackGeneration(
      {
        kind: 'mock_exam',
        userId: source.user_id,
        studyKitId: source.study_kit_id,
        sourceId,
        language: params.language,
        sourceText: source.extracted_text,
        request: { count: params.count, reasoningEffort: 'medium' },
        describe: (value) => ({
          questions: value.questions?.length ?? 0,
          hard: value.questions?.filter((q) => q.difficulty === 'hard').length ?? 0,
        }),
      },
      ({ onUsage }) =>
        ai.generateMockExam({
          text: source.extracted_text,
          title: source.name,
          language: params.language,
          count: params.count,
          reasoningEffort: 'medium',
          onUsage,
        }),
    );

    const validated = validateGeneratedExam(raw, params.count);
    // Same reasoning as the quiz path: a model writes the true statement first
    // and invents distractors around it, so the answer lands on A far more
    // often than chance and a student who notices stops reading. Shuffling here
    // makes the spread a property of the code. `expectedAnswer` is prose, so it
    // is unaffected by options moving; `correctAnswer` is rewritten to the new
    // index by balanceAnswerPositions and is what gets stored.
    const exam = { ...validated, questions: balanceAnswerPositions(validated.questions) };
    await mockExamDb.saveBank({ cacheId, source, exam, params, model: ai.name });
  } catch (error) {
    await summariesDb.failCache(cacheId, error.message);
  } finally {
    activeCaches.delete(cacheId);
  }
};

jobQueue.register('mockExam.generate', runGeneration);

export const mockExamService = {
  /**
   * Generates the bank during ingest, so starting an exam is instant.
   *
   * On demand would mean a "generating…" wait on a screen that has never had
   * one. Every other study material is prewarmed the same way, for the same
   * reason.
   */
  async prewarm(sourceId, { language }) {
    const params = { count: BANK_SIZE, language };
    const key = summaryCacheKey({ sourceId, method: 'generateMockExam', params });
    const cache = await summariesDb.getOrCreateCache(key);
    if (cache.status === 'ready') return;
    await runGeneration({ cacheId: cache.id, sourceId, params });
  },

  /**
   * Queues a bank for a source that predates this feature, without blocking.
   *
   * Called when a session finds no bank. The student's exam falls back to the
   * quiz pool this once; the bank is waiting for them next time.
   *
   * The language is derived from the source text here rather than passed in,
   * exactly as ingest derives it. It is part of the cache key, so a caller
   * guessing 'km' for an English document would key a second bank that the
   * prewarmed path never looks at — two generations billed, one of them in the
   * wrong language and permanently orphaned.
   */
  async ensure(sourceId) {
    const source = await sourcesDb.findByIdUnscoped(sourceId);
    if (!source?.extracted_text) return;
    const params = { count: BANK_SIZE, language: detectCostLanguage(source.extracted_text) };
    const key = summaryCacheKey({ sourceId, method: 'generateMockExam', params });
    const cache = await summariesDb.getOrCreateCache(key);
    if (cache.status === 'ready' || activeCaches.has(cache.id)) return;
    activeCaches.add(cache.id);
    jobQueue.enqueue('mockExam.generate', { cacheId: cache.id, sourceId, params });
  },
};
