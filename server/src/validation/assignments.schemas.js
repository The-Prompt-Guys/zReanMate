import { z } from 'zod';

const uuid = z.uuid('Not a valid id');
export const assignmentParams = z.object({ assignmentId: uuid });
export const lessonAssignmentParams = z.object({ lessonId: uuid });
export const gradeParams = z.object({ assignmentId: uuid, submissionId: uuid });
export const createAssignmentBody = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  instructions: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
  dueAt: z.iso.datetime(),
  type: z.enum(['file', 'quiz']),
  quizId: uuid.optional(),
  points: z.number().nonnegative().max(100000).optional(),
}).refine((value) => value.type !== 'quiz' || value.quizId, {
  path: ['quizId'], message: 'Quiz assignments require a quiz',
});
export const saveSubmissionBody = z.strictObject({
  answers: z.record(uuid, z.union([z.string().max(10000), z.number(), z.boolean(), z.null()])),
  submit: z.boolean().default(false),
});
export const gradeSubmissionBody = z.strictObject({
  score: z.number().nonnegative().max(100000),
  feedback: z.string().trim().max(10000).optional(),
});
