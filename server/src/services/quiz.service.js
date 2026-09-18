import { getAI } from '../ai/index.js';
import { quizDb } from '../db/quiz.db.js';
import { summariesDb } from '../db/summaries.db.js';
import { sourcesDb } from '../db/sources.db.js';
import { jobQueue } from '../jobs/queue.js';
import { ApiError } from '../middleware/errors.js';
import { summaryCacheKey } from './summaries.service.js';
import { plansService } from './plans.service.js';
import { trackGeneration } from './aiUsage.service.js';

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
      targetedWeakConcept:
        typeof question.targetedWeakConcept === 'string' && question.targetedWeakConcept.trim()
          ? question.targetedWeakConcept.trim()
          : null,
    };
  });
  return { title: quiz.title.trim(), questions };
};

/**
 * Spreads the correct answers evenly across A, B, C and D.
 *
 * This is done here rather than asked for in the prompt, because asking does
 * not work. A model writes the true statement first and then invents three
 * wrong ones around it, so the answer lands on A far more often than chance —
 * and a student who notices picks A without reading, which makes the quiz
 * measure nothing. Telling it to "randomise" produces a model's idea of random,
 * which is still lopsided and is unverifiable per quiz.
 *
 * Shuffling after generation makes the distribution a property of the code:
 * positions are dealt from a bag holding each slot an equal number of times, so
 * a 10-question quiz is 3/3/2/2 across the four slots no matter what the model
 * did. The remainder goes to random slots, so it is not always A and B that get
 * the extra one.
 *
 * Distractors are shuffled among the remaining slots too — otherwise two quizzes
 * on the same material read as the same list with one item moved.
 *
 * `random` is injectable so tests are deterministic; nothing about the result
 * depends on the sequence being unpredictable, only on it being even.
 *
 * Questions with no options (short answer, written) pass through untouched.
 */
export const balanceAnswerPositions = (questions, random = Math.random) => {
  const shuffled = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // One bag per option count: four-option questions are balanced across four
  // slots, and a two-option question cannot be dealt into slot C.
  const bags = new Map();
  const takeSlot = (optionCount, total) => {
    if (!bags.has(optionCount)) {
      const base = Math.floor(total / optionCount);
      const slots = [];
      for (let slot = 0; slot < optionCount; slot += 1) {
        for (let n = 0; n < base; n += 1) slots.push(slot);
      }
      // The leftovers land on randomly chosen slots rather than the first ones.
      const remainder = shuffled([...Array(optionCount).keys()]).slice(0, total - slots.length);
      bags.set(optionCount, shuffled([...slots, ...remainder]));
    }
    const bag = bags.get(optionCount);
    return bag.length ? bag.pop() : Math.floor(random() * optionCount);
  };

  const counts = new Map();
  for (const question of questions) {
    if (Number.isInteger(question.correctAnswer) && question.options.length > 1) {
      counts.set(question.options.length, (counts.get(question.options.length) ?? 0) + 1);
    }
  }

  return questions.map((question) => {
    const optionCount = question.options.length;
    // Only choice questions have a position to move; a written answer has none.
    if (!Number.isInteger(question.correctAnswer) || optionCount < 2) return question;

    const target = takeSlot(optionCount, counts.get(optionCount) ?? 1);
    const correct = question.options[question.correctAnswer];
    const distractors = shuffled(question.options.filter((_, i) => i !== question.correctAnswer));

    const options = [];
    for (let slot = 0; slot < optionCount; slot += 1) {
      options.push(slot === target ? correct : distractors.pop());
    }

    return { ...question, options, correctAnswer: target };
  });
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
  // Named on screen so the student can see the quiz is working on their weak
  // spots rather than asking again at random.
  targetedWeakConcept: row.targeted_weak_concept ?? null,
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
    // Gathered for the student the quiz is FOR, which is not always the
    // source's owner — a class material is sat by every enrolled student, and
    // each of them is weak at different things.
    const forUserId = params.userId ?? source.user_id;
    const [avoidQuestions, weakRows] = await Promise.all([
      quizDb.seenQuestions({ userId: forUserId, sourceId }),
      quizDb.weakTopics({ userId: forUserId, sourceId }),
    ]);
    const weakTopics = weakRows.map((row) => row.topic);

    const raw = await trackGeneration(
      {
        kind: 'quiz',
        userId: source.user_id,
        studyKitId: source.study_kit_id,
        sourceId,
        language: params.language,
        sourceText: source.extracted_text,
        request: {
          count: params.count,
          difficulty: params.difficulty,
          reasoningEffort: 'medium',
          round: params.round ?? 0,
          avoiding: avoidQuestions.length,
          weakTopics: weakTopics.length,
        },
        describe: (value) => ({
          questions: value.questions?.length ?? 0,
          targeted: value.questions?.filter((q) => q.targetedWeakConcept).length ?? 0,
        }),
      },
      ({ onUsage }) =>
        ai.generateQuiz({ text: source.extracted_text, title: source.name,
          language: params.language, difficulty: params.difficulty, count: params.count,
          avoidQuestions, weakTopics,
          reasoningEffort: 'medium', onUsage }),
    );
    const validated = validateGeneratedQuiz(raw, params.count);
    // Shuffled before it is stored, so the position a student sees is the one
    // that was graded — the answer index in the row IS the shuffled one.
    const quiz = { ...validated, questions: balanceAnswerPositions(validated.questions) };
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

/**
 * `prewarm` runs a generation inline and waits for it, where `generate` creates
 * the cache row and hands the work to the queue for a polling screen to collect.
 *
 * Ingest uses it so that a source only reaches `ready` once its materials
 * actually exist — opening the Study Guide after that is a cache read, not a
 * fresh call to the model. It reuses a ready cache and relies on `claimCache`
 * to step aside if a screen happened to ask for the same thing first.
 */
export const quizService = {
  async prewarm(userId, sourceId, { language }) {
    // Round 0, generated during ingest: there is no history yet by definition,
    // so this is the evenly-spread quiz every student starts from.
    const params = {
      count: await plansService.generationCount(userId, 'quiz'),
      difficulty: 'mixed',
      language,
      userId,
      round: 0,
    };
    const key = summaryCacheKey({ sourceId, method: 'generateQuiz', params });
    const cache = await summariesDb.getOrCreateCache(key);
    if (cache.status === 'ready') return;
    await runGeneration({ cacheId: cache.id, sourceId, params });
  },

  /**
   * The quiz for this student, this round.
   *
   * `round` is how many quizzes on this material they have already submitted,
   * and it is part of the cache key — so sitting a quiz and asking for another
   * gets a genuinely new one, while reloading mid-quiz gets the same one back
   * rather than paying for a regeneration. `userId` is in the key for the same
   * reason the history is read per student: two students on the same class
   * material are weak at different things and must not share a cached quiz.
   */
  async generate(userId, _plan, sourceId, input) {
    await requireSource(userId, sourceId);
    const params = {
      count: await plansService.generationCount(userId, 'quiz'),
      difficulty: input.difficulty,
      language: input.language,
      userId,
      round: await quizDb.completedRounds({ userId, sourceId }),
    };
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
      const prose = await trackGeneration(
        {
          kind: 'takeaways',
          userId,
          language: stats.language,
          request: {
            totalQuestions: stats.total_questions,
            correctCount: stats.computedCorrect,
            missedTopics: stats.missedTopics?.length ?? 0,
          },
          describe: (value) => ({ takeaways: value.takeaways?.length ?? 0 }),
        },
        ({ ai, onUsage }) =>
          ai.summarizeAttempt({ correctCount: stats.computedCorrect,
            totalQuestions: stats.total_questions, missedTopics: stats.missedTopics,
            quizTitle: stats.quiz_title, language: stats.language, onUsage }),
      );
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
