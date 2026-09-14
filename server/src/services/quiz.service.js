import { getAI } from '../ai/index.js';
import { quizDb } from '../db/quiz.db.js';
import { summariesDb } from '../db/summaries.db.js';
import { sourcesDb } from '../db/sources.db.js';
import { jobQueue } from '../jobs/queue.js';
import { ApiError } from '../middleware/errors.js';
import { summaryCacheKey } from './summaries.service.js';
import { plansService } from './plans.service.js';

const activeCaches = new Set();
const activeSubmissions = new Map();

const normalizedOption = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('und');

export const validateGeneratedQuiz = (quiz, expectedCount) => {
  if (!quiz || typeof quiz !== 'object' || typeof quiz.title !== 'string' || !quiz.title.trim()) {
    throw new Error('generateQuiz: quiz title must be non-empty');
  }
  if (!Array.isArray(quiz.questions) || quiz.questions.length !== expectedCount) {
    throw new Error(`generateQuiz: expected exactly ${expectedCount} questions, got ${quiz.questions?.length ?? 'invalid'}`);
  }
  const supported = new Set(['multiple_choice', 'true_false', 'short_answer', 'written']);
  const questions = quiz.questions.map((question, index) => {
    const label = `generateQuiz: question ${index + 1}`;
    if (!question || typeof question !== 'object' || !supported.has(question.kind)) throw new Error(`${label} has an unsupported kind`);
    if (typeof question.prompt !== 'string' || !question.prompt.trim()) throw new Error(`${label} has an empty prompt`);
    if (typeof question.explanation !== 'string' || !question.explanation.trim()) throw new Error(`${label} has an empty explanation`);
    if (!Array.isArray(question.options)) throw new Error(`${label} options must be an array`);

    const isChoice = question.kind === 'multiple_choice' || question.kind === 'true_false';
    const requiredOptions = question.kind === 'multiple_choice' ? 4 : 2;
    if (isChoice && question.options.length !== requiredOptions) throw new Error(`${label} requires exactly ${requiredOptions} options`);
    if (!isChoice && question.options.length !== 0) throw new Error(`${label} must not have choice options`);
    if (question.options.some((option) => typeof option !== 'string' || !option.trim())) throw new Error(`${label} has an empty option`);
    const normalized = question.options.map(normalizedOption);
    if (new Set(normalized).size !== normalized.length) throw new Error(`${label} has duplicate options`);
    if (isChoice && (!Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer >= question.options.length)) throw new Error(`${label} correct index is out of range`);
    if (!isChoice && (typeof question.correctAnswer !== 'string' || !question.correctAnswer.trim())) throw new Error(`${label} needs a non-empty written answer`);
    return {
      ...question,
      prompt: question.prompt.trim(),
      options: question.options.map((option) => option.trim()),
      explanation: question.explanation.trim(),
      correctAnswer: typeof question.correctAnswer === 'string' ? question.correctAnswer.trim() : question.correctAnswer,
      topic: typeof question.topic === 'string' ? question.topic.trim() : '',
    };
  });
  return { title: quiz.title.trim(), questions };
};

const requireSource = async (userId, sourceId) => {
  const source = await sourcesDb.findAccessibleById({ userId, sourceId });
  if (!source) throw ApiError.notFound('That source does not exist');
  if (source.status !== 'ready' || !source.extracted_text) throw ApiError.conflict('That source is not ready for a quiz');
  return source;
};

const questionApi = (row) => ({
  id: row.id, position: row.position, kind: row.kind, prompt: row.prompt,
  options: row.options, explanation: row.is_correct === null ? null : row.explanation,
  topic: row.topic_label, response: row.response, isCorrect: row.is_correct,
  correctAnswer: row.revealed_answer,
});
const attemptApi = (row) => ({
  id: row.id, quizId: row.quiz_id, status: row.status, total: row.total_questions,
  correct: row.correct_count, mastery: row.mastery_percent, takeaways: row.takeaways,
  startedAt: row.started_at, submittedAt: row.submitted_at,
});

const runGeneration = async ({ cacheId, sourceId, params }) => {
  try {
    const claimed = await summariesDb.claimCache(cacheId);
    if (!claimed) return;
    const source = await sourcesDb.findByIdUnscoped(sourceId);
    const ai = getAI();
    const raw = await ai.generateQuiz({ text: source.extracted_text, title: source.name,
      language: params.language, difficulty: params.difficulty, count: params.count,
      reasoningEffort: 'medium' });
    const quiz = validateGeneratedQuiz(raw, params.count);
    await quizDb.saveGenerated({ cacheId, source, quiz, params, model: ai.name });
  } catch (error) {
    await summariesDb.failCache(cacheId, error.message);
  } finally { activeCaches.delete(cacheId); }
};
jobQueue.register('quiz.generate', runGeneration);

const quizSnapshot = async (cache) => {
  const current = await summariesDb.findCache(cache.id);
  const quiz = await quizDb.byCache(cache.id);
  return {
    cache: { sourceId: current.source_id, method: current.method, params: current.params, paramsHash: current.params_hash },
    status: current.status,
    quiz: quiz ? { id: quiz.id, title: quiz.title, language: quiz.language, difficulty: quiz.difficulty, questionCount: quiz.question_count } : null,
  };
};

export const quizService = {
  async generate(userId, _plan, sourceId, input) {
    await requireSource(userId, sourceId);
    const params = { count: await plansService.generationCount(userId, 'quiz'), difficulty: input.difficulty, language: input.language };
    const key = summaryCacheKey({ sourceId, method: 'generateQuiz', params });
    const cache = await summariesDb.getOrCreateCache(key);
    if (cache.status !== 'ready' && !activeCaches.has(cache.id)) {
      activeCaches.add(cache.id);
      jobQueue.enqueue('quiz.generate', { cacheId: cache.id, sourceId, params });
    }
    return quizSnapshot(cache);
  },

  async start(userId, quizId) {
    const attempt = await quizDb.startAttempt({ userId, quizId });
    if (!attempt) throw ApiError.notFound('That quiz does not exist');
    const questions = await quizDb.questions(quizId, { answersForAttemptId: attempt.id });
    return { attempt: attemptApi(attempt), questions: questions.map(questionApi) };
  },

  async getAttempt(userId, attemptId) {
    const attempt = await quizDb.attempt({ userId, attemptId });
    if (!attempt) throw ApiError.notFound('That quiz attempt does not exist');
    const questions = await quizDb.questions(attempt.quiz_id, { answersForAttemptId: attempt.id });
    return { attempt: attemptApi(attempt), questions: questions.map(questionApi) };
  },

  async answer(userId, attemptId, input) {
    const answer = await quizDb.saveAnswer({ userId, attemptId, questionId: input.questionId, response: input.response, timeSpentSeconds: input.timeSpentSeconds });
    if (!answer) throw ApiError.conflict('That attempt cannot accept this answer');
    const attempt = await quizDb.attempt({ userId, attemptId });
    const question = (await quizDb.questions(attempt.quiz_id, { answersForAttemptId: attemptId })).find((item) => item.id === input.questionId);
    return { answer: { questionId: input.questionId, response: answer.response, isCorrect: answer.is_correct, correctAnswer: question.revealed_answer, explanation: question.explanation } };
  },

  async submit(userId, attemptId) {
    if (activeSubmissions.has(attemptId)) return activeSubmissions.get(attemptId);
    const work = (async () => {
      const stats = await quizDb.submitStats({ userId, attemptId });
      if (!stats) throw ApiError.notFound('That quiz attempt does not exist');
      if (stats.status === 'submitted') return { attempt: attemptApi(stats) };
      const mastery = Math.round((stats.computedCorrect / Math.max(1, stats.total_questions)) * 100);
      const prose = await getAI().summarizeAttempt({ correctCount: stats.computedCorrect,
        totalQuestions: stats.total_questions, missedTopics: stats.missedTopics,
        quizTitle: stats.quiz_title, language: stats.language });
      const finished = await quizDb.finishAttempt({ userId, attemptId, correct: stats.computedCorrect,
        mastery, takeaways: prose.takeaways });
      if (!finished) {
        const current = await quizDb.attempt({ userId, attemptId });
        return { attempt: attemptApi(current) };
      }
      return { attempt: attemptApi(finished) };
    })();
    activeSubmissions.set(attemptId, work);
    try { return await work; } finally { activeSubmissions.delete(attemptId); }
  },
};
