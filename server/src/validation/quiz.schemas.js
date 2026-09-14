import { z } from 'zod';

const uuid = z.uuid('Not a valid id');
export const quizSourceParams = z.object({ id: uuid });
export const quizIdParams = z.object({ quizId: uuid });
export const attemptIdParams = z.object({ attemptId: uuid });
export const generateQuizBody = z.strictObject({
  language: z.enum(['km', 'en']).default('km'),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
});
export const answerBody = z.strictObject({
  questionId: uuid,
  response: z.union([z.number().int().nonnegative(), z.string().trim().min(1).max(4000)]),
  timeSpentSeconds: z.number().int().nonnegative().max(86400).optional(),
});
