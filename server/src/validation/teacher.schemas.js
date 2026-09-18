import { z } from 'zod';

const uuid = z.uuid('Not a valid id');

export const teacherClassParams = z.object({ classId: uuid });
export const teacherMaterialParams = z.object({ classId: uuid, materialId: uuid });
export const teacherAssignmentParams = z.object({ assignmentId: uuid });
export const teacherAssignmentUpdateBody = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  instructions: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
  dueAt: z.iso.datetime().nullable(),
  points: z.number().nonnegative().max(100000),
  publish: z.boolean().optional(),
});

export const updateTeacherClassBody = z.strictObject({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  subject: z.string().trim().max(200).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export const teacherAssistantQuestionBody = z.strictObject({
  classId: uuid.optional(),
  conversationId: uuid.optional(),
  content: z.string().trim().min(1).max(4000),
  language: z.enum(['km', 'en']).default('km'),
});

export const teacherQuizDraftBody = z.strictObject({
  classId: uuid,
  sourceMaterialIds: z.array(uuid).max(20).default([]),
  title: z.string().trim().min(1).max(200).optional(),
  language: z.enum(['km', 'en']).default('km'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  questionTypes: z.array(z.enum(['multipleChoice', 'trueFalse', 'shortAnswer'])).min(1).max(3).default(['multipleChoice', 'trueFalse']),
  count: z.number().int().min(1).max(30).default(10),
  includeAnswerKey: z.boolean().default(true),
});

export const createTeacherAssignmentBody = z.strictObject({
  classId: uuid,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  instructions: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
  dueAt: z.iso.datetime().nullable().optional(),
  points: z.number().nonnegative().max(100000).optional(),
  type: z.enum(['file', 'quiz']).default('file'),
  quizId: uuid.optional(),
  publish: z.boolean().default(true),
}).refine((value) => value.type !== 'quiz' || value.quizId, {
  path: ['quizId'], message: 'Quiz assignments require a quiz',
});

export const createTeacherQuizBody = z.strictObject({
  classId: uuid,
  title: z.string().trim().min(1).max(200),
  language: z.enum(['km', 'en']).default('km'),
  count: z.number().int().min(1).max(30).default(10),
  dueAt: z.iso.datetime().nullable().optional(),
  points: z.number().nonnegative().max(100000).optional(),
  publish: z.boolean().default(true),
  questions: z.array(z.object({
    kind: z.enum(['multiple_choice', 'true_false', 'short_answer']),
    prompt: z.string().trim().min(1).max(4000),
    options: z.array(z.string().trim().max(1000)).max(4).default([]),
    correctAnswer: z.union([z.number().int().nonnegative(), z.string().trim()]),
    explanation: z.string().max(4000).default(''),
  })).max(30).optional(),
});