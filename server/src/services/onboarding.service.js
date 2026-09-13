import { usersDb } from '../db/users.db.js';
import { onboardingDb } from '../db/onboarding.db.js';
import { ApiError } from '../middleware/errors.js';

const SURVEY_VERSION = 1;

/**
 * The three survey questions, mirroring
 * docs/screens/01-auth-onboarding/05, 06 and 07. Kept here rather than in the
 * zod schema so the answer vocabulary lives in one place — the schema imports
 * it, and a new option is a one-line change.
 */
export const SURVEY_QUESTIONS = {
  improveFirst: ['understand_topics', 'remember', 'exam_prep', 'daily_habit'],
  studyStyle: ['short_sessions', 'deep_study', 'mix', 'unsure'],
  studyFrequency: ['every_day', 'few_times_week', 'once_week', 'decide_later'],
};

export const onboardingService = {
  async setRole(userId, role) {
    const user = await usersDb.setRole(userId, role);
    if (!user) throw ApiError.notFound('That account no longer exists');
    return user;
  },

  /**
   * Accepts a partial set of answers — the survey is three screens and each
   * submits on its own, so answers merge rather than replace (see
   * onboardingDb.saveAnswers). `complete` marks the run finished, which is what
   * the client sends on the last step or on Skip.
   */
  async submitSurvey(userId, { answers = {}, skipped = false, complete = false }) {
    const known = Object.keys(SURVEY_QUESTIONS);
    const unknown = Object.keys(answers).filter((key) => !known.includes(key));
    if (unknown.length > 0) {
      throw ApiError.badRequest(`Unknown survey question(s): ${unknown.join(', ')}`);
    }

    const response = await onboardingDb.saveAnswers({
      userId,
      answers,
      skipped,
      surveyVersion: SURVEY_VERSION,
      completed: complete || skipped,
    });

    const user = complete || skipped ? await usersDb.markOnboardingComplete(userId) : null;

    return { response, user };
  },

  async getSurvey(userId) {
    return onboardingDb.findByUserId(userId);
  },
};
