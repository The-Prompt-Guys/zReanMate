import { practiceDb } from '../db/practice.db.js';
import { ApiError } from '../middleware/errors.js';
import { plansService } from './plans.service.js';

export const topicWeight = (mastery) => 1 + 4 * ((100 - (mastery ?? 35)) / 100) ** 2;

export const weightedWithoutReplacement = (items, random = Math.random) => {
  const pool = items.map((item) => ({ ...item, weight: topicWeight(item.effective_mastery) }));
  const selected = [];
  while (pool.length) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      cursor -= pool[i].weight;
      if (cursor <= 0) { index = i; break; }
    }
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
};

const sessionApi = (row) => ({
  id: row.id, kitId: row.study_kit_id, sourceId: row.source_id ?? null, mode: row.mode,
  questionCount: row.question_count, answerFormat: row.answer_format,
  timerSeconds: row.timer_seconds, status: row.status,
  answered: row.answered_count, correct: row.correct_count,
  mastery: row.mastery_percent, weakTopics: row.weak_topics ?? [],
  durationSeconds: row.duration_seconds, startedAt: row.started_at,
  completedAt: row.completed_at,
});
const questionApi = (row) => ({ id: row.id, position: row.position, prompt: row.prompt,
  options: row.options, response: row.response, answeredAt: row.answered_at });

const streakFor = (values) => {
  if (!values.length) return 0;
  const days = new Set(values.map((value) => new Date(value).toISOString().slice(0, 10)));
  const cursor = new Date(); cursor.setUTCHours(0, 0, 0, 0);
  const today = cursor.toISOString().slice(0, 10);
  if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return streak;
};

export const practiceService = {
  async topics(userId, q, sourceId = null) {
    const rows = await practiceDb.topics({ userId, q, sourceId });
    return rows.map((row) => ({ id: row.id, kitId: row.study_kit_id, title: row.name,
      mastery: row.mastery_percent === null ? null : row.mastery_percent,
      effectiveMastery: row.effective_mastery, recommended: row.effective_mastery < 50,
      needsPractice: row.effective_mastery < 30 }));
  },

  async create(userId, _plan, input) {
    if (input.mode === 'mock_exam') await plansService.requireFeature(userId, 'mock_exams');
    const weeklyLimit = await plansService.getLimit(userId, 'practice_sessions_per_week');
    const sourceId = input.sourceId ?? null;
    let candidates = await practiceDb.candidateQuestions({ userId, kitId: input.studyKitId, topicIds: input.topicIds, sourceId });
    if (input.topicIds.length > 0 && candidates.length < input.questionCount) {
      // Topping up ignores the chosen topics but keeps the source filter — the
      // shortfall is made up from elsewhere in the same file, never from the
      // rest of the kit.
      const all = await practiceDb.candidateQuestions({ userId, kitId: input.studyKitId, topicIds: [], sourceId });
      const seen = new Set(candidates.map((item) => item.id));
      candidates = [...candidates, ...all.filter((item) => !seen.has(item.id))];
    }
    const result = await practiceDb.create({ userId, input, weeklyLimit,
      weightedOrder: weightedWithoutReplacement(candidates) });
    if (result.missing) throw ApiError.notFound('That study kit does not exist');
    if (result.quotaExceeded) throw new ApiError(429, 'quota_exceeded', 'Weekly practice limit reached', { used: result.used, limit: result.limit });
    if (result.insufficient) throw ApiError.conflict('Not enough generated questions for those settings', { available: result.available, requested: input.questionCount });
    return { session: sessionApi(result.session), quota: result.limit === null ? null : { used: result.used + 1, limit: result.limit, remaining: Math.max(0, result.limit - result.used - 1) } };
  },

  async get(userId, sessionId) {
    const session = await practiceDb.session({ userId, sessionId });
    if (!session) throw ApiError.notFound('That practice session does not exist');
    const questions = await practiceDb.questions(sessionId);
    return { session: sessionApi(session), questions: questions.map(questionApi) };
  },

  async answer(userId, sessionId, input) {
    const answer = await practiceDb.answer({ userId, sessionId, input });
    if (!answer) throw ApiError.conflict('That practice session cannot accept this answer');
    return { answer: { position: answer.position, response: answer.response, answeredAt: answer.answered_at } };
  },

  async submit(userId, sessionId, input = {}) {
    const row = await practiceDb.submit({ userId, sessionId, durationSeconds: input.durationSeconds });
    if (!row) throw ApiError.notFound('That practice session does not exist');
    return { result: { ...sessionApi(row), total: row.question_count,
      toReview: row.answered_count - row.correct_count } };
  },

  async home(userId) {
    const row = await practiceDb.home(userId);
    return { continue: row ? { sessionId: row.id, kitId: row.study_kit_id, title: row.title,
      answered: row.answered_count, total: row.question_count } : null };
  },

  async progress(userId) {
    const data = await practiceDb.progress(userId);
    return {
      hasActivity: data.daily.length > 0,
      accuracyOverTime: data.daily.map((row) => ({ date: row.date, correct: row.correct,
        total: row.total, accuracy: Math.round((row.correct / Math.max(1, row.total)) * 100) })),
      topics: data.topics.map((row) => ({ id: row.id, name: row.name,
        mastery: row.mastery_percent, attempts: row.attempts })),
      activityStreak: streakFor(data.dates),
    };
  },
};
