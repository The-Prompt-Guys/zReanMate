import { z } from 'zod';
const uuid = z.uuid('Not a valid id');
export const practiceSessionParams = z.object({ sessionId: uuid });
export const practiceTopicsQuery = z.object({ q: z.string().trim().max(200).optional() });
export const createPracticeBody = z.strictObject({
  studyKitId: uuid,
  mode: z.enum(['practice', 'mock_exam']).default('practice'),
  questionCount: z.number().int().min(1).max(100),
  answerFormat: z.enum(['multiple_choice', 'written']),
  timerSeconds: z.number().int().min(0).max(7200),
  topicIds: z.array(uuid).max(100).default([]),
});
export const practiceAnswerBody = z.strictObject({
  position: z.number().int().min(1),
  response: z.union([z.number().int().nonnegative(), z.string().trim().min(1).max(4000)]),
  timeSpentSeconds: z.number().int().min(0).max(86400).optional(),
});
export const submitPracticeBody = z.strictObject({ durationSeconds: z.number().int().min(0).max(86400).optional() });
