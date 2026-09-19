import { getAI } from '../ai/index.js';
import { mockExamDb } from '../db/mockExam.db.js';
import { practiceDb } from '../db/practice.db.js';
import { ApiError } from '../middleware/errors.js';
import { mockExamService } from './mockExam.service.js';
import { plansService } from './plans.service.js';
import { detectCostLanguage, trackGeneration } from './aiUsage.service.js';

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
  timerSeconds: row.timer_seconds, expiresAt: row.expires_at, status: row.status,
  answered: row.answered_count, correct: row.correct_count,
  mastery: row.mastery_percent, weakTopics: row.weak_topics ?? [],
  durationSeconds: row.duration_seconds, startedAt: row.started_at,
  completedAt: row.completed_at,
});
const questionApi = (row) => ({ id: row.id, position: row.position, prompt: row.prompt,
  options: row.options, response: row.response, answeredAt: row.answered_at,
  // Only meaningful once the session is submitted — until then a written
  // answer is deliberately unmarked. `graderNote` says WHY a written answer was
  // marked as it was: unlike a wrong multiple-choice answer, a wrong mark on
  // free text is not self-evident to the student who wrote it.
  isCorrect: row.is_correct ?? null,
  graderNote: row.grader_note ?? null });

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

/**
 * Picks the questions for one sitting out of the exam bank.
 *
 * Returns null when there is no bank, which is the signal to fall back — a
 * source ingested before banks existed has none, and an exam that refuses to
 * start is worse than one drawn from the quiz pool.
 *
 * Shuffled rather than mastery-weighted, and that difference is the point. A
 * practice session leans on what the student is worst at; an exam samples the
 * document evenly, because an exam that quietly avoided the parts you already
 * know would not tell you whether you are ready.
 *
 * `weight` is 0 on every row: the column records the mastery weight a question
 * was chosen for, and these were not chosen for one.
 */
const examDraw = async ({ userId, input, sourceId, provider }) => {
  void provider;
  const bank = await mockExamDb.bankQuestions({ userId, kitId: input.studyKitId, sourceId });
  if (bank.length < input.questionCount) return null;

  const shuffled = [...bank];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((row) => ({
    id: null,
    topic_id: row.topic_id,
    prompt: row.prompt,
    options: row.options,
    correct_answer: row.correct_answer,
    // What a typed answer is marked against. A quiz question has only an index
    // into its options, which is why written answers have been graded by
    // string-matching one option's wording.
    expected_answer: row.expected_answer,
    explanation: row.explanation,
    weight: 0,
  }));
};

/**
 * Marks every written answer in one call.
 *
 * Positions are carried through rather than relying on array index alignment.
 * The provider contract says grades come back in input order, but a provider
 * that returns the wrong number would otherwise shift every later mark onto the
 * wrong answer — so the count is checked and the marks are keyed by position.
 */
const gradeWritten = async ({ userId, sessionId, session }) => {
  const pending = await practiceDb.ungradedWritten(sessionId);
  if (pending.length === 0) return 0;

  const answers = pending.map((row) => ({
    prompt: row.prompt,
    expectedAnswer: row.expected_answer,
    response: typeof row.response === 'string' ? row.response : String(row.response ?? ''),
  }));

  // The note goes to the student, so it has to be in their language. There is
  // no language column on practice_sessions, and the student's response is the
  // wrong thing to read — an empty or one-word answer says nothing. The answer
  // key is in the document's language by construction, so that is what is read.
  // Defaulting instead would have handed a Khmer note to every English exam,
  // because the provider's default is 'km'.
  const language = detectCostLanguage(answers.map((a) => a.expectedAnswer).join('\n')) ?? 'km';

  const grades = await trackGeneration(
    {
      kind: 'mock_exam',
      userId,
      studyKitId: session.study_kit_id,
      sourceId: session.source_id ?? null,
      language,
      sourceText: answers.map((a) => a.response).join('\n'),
      request: { graded: answers.length, mode: session.mode },
      describe: (value) => ({ correct: value.filter((g) => g.isCorrect).length }),
    },
    ({ ai, onUsage }) => ai.gradeWrittenAnswers({ answers, language, onUsage }),
  );

  if (!Array.isArray(grades) || grades.length !== pending.length) {
    throw new Error(`grading returned ${grades?.length ?? 'nothing'} marks for ${pending.length} answers`);
  }

  return practiceDb.applyGrades(
    sessionId,
    pending.map((row, index) => ({
      position: row.position,
      isCorrect: Boolean(grades[index].isCorrect),
      note: grades[index].note,
    })),
  );
};

const finishCreate = (result, input, weeklyLimit) => {
  void weeklyLimit;
  if (result.missing) throw ApiError.notFound('That study kit does not exist');
  if (result.quotaExceeded) throw new ApiError(429, 'quota_exceeded', 'Weekly practice limit reached', { used: result.used, limit: result.limit });
  if (result.insufficient) throw ApiError.conflict('Not enough generated questions for those settings', { available: result.available, requested: input.questionCount });
  return { session: sessionApi(result.session), quota: result.limit === null ? null : { used: result.used + 1, limit: result.limit, remaining: Math.max(0, result.limit - result.used - 1) } };
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
    const weeklyLimit = await plansService.getLimit(userId, 'practice_sessions_per_week');
    const sourceId = input.sourceId ?? null;
    // Questions the mock provider wrote are excluded while a real provider is
    // active — see practiceDb.candidateQuestions. They describe a database
    // whatever the student uploaded.
    const provider = getAI().name;

    // `mode` is finally read. It was written to the row and never looked at
    // again, which is why a mock exam and a practice session asked the same
    // questions out of the same pool.
    if (input.mode === 'mock_exam') {
      const drawn = await examDraw({ userId, input, sourceId, provider });
      if (drawn) {
        return finishCreate(await practiceDb.create({
          userId, input, weeklyLimit, weightedOrder: drawn,
        }), input, weeklyLimit);
      }
      // No bank yet — a source ingested before exam banks existed. Queue one
      // for next time and fall through to the quiz pool rather than making the
      // student wait on a screen that has never had a loading state.
      if (sourceId) {
        mockExamService
          .ensure(sourceId)
          .catch((err) => console.error(`[practice] exam bank backfill failed: ${err.message}`));
      }
    }

    let candidates = await practiceDb.candidateQuestions({ userId, kitId: input.studyKitId, topicIds: input.topicIds, sourceId, provider });
    if (input.topicIds.length > 0 && candidates.length < input.questionCount) {
      // Topping up ignores the chosen topics but keeps the source filter — the
      // shortfall is made up from elsewhere in the same file, never from the
      // rest of the kit.
      const all = await practiceDb.candidateQuestions({ userId, kitId: input.studyKitId, topicIds: [], sourceId, provider });
      const seen = new Set(candidates.map((item) => item.id));
      candidates = [...candidates, ...all.filter((item) => !seen.has(item.id))];
    }
    return finishCreate(
      await practiceDb.create({ userId, input, weeklyLimit,
        weightedOrder: weightedWithoutReplacement(candidates) }),
      input,
      weeklyLimit,
    );
  },

  async get(userId, sessionId) {
    await practiceDb.expire({ userId, sessionId });
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

  /**
   * Marks the written answers, then closes the session.
   *
   * Order matters and is not incidental: practiceDb.submit derives
   * correct_count, mastery_percent and weak_topics from `is_correct`, and an
   * answer left unmarked is not true, so grading afterwards would score every
   * written response wrong and then report that as the student's mastery.
   *
   * One batched call for the whole session rather than one per answer, which is
   * why answers are stored unmarked as they are typed.
   *
   * A grading failure does NOT block submission. The exam was sat; refusing to
   * close it because the grader was unavailable would strand the student in a
   * session they cannot leave, and multiple-choice answers are already marked
   * and correct. The written ones stay unmarked, which reads as not-correct,
   * and the failure is logged rather than swallowed silently.
   */
  async submit(userId, sessionId, input = {}) {
    const session = await practiceDb.session({ userId, sessionId });
    if (!session) throw ApiError.notFound('That practice session does not exist');

    if (session.status === 'in_progress') {
      try {
        await gradeWritten({ userId, sessionId, session });
      } catch (err) {
        console.error(`[practice] grading session ${sessionId} failed: ${err.message}`);
      }
    }

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
