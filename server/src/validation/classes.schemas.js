import { z } from 'zod';

const uuid = z.uuid('Not a valid id');
export const classParams = z.object({ classId: uuid });
export const classKitParams = z.object({ classId: uuid, kitId: uuid });
export const lessonItemParams = z.object({ itemId: uuid });
export const createClassBody = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  subject: z.string().trim().max(200).optional(),
  weekCount: z.number().int().min(1).max(52).default(12),
});
export const joinClassBody = z.strictObject({
  code: z.string().trim().min(4).max(20).transform((value) => value.toUpperCase()),
});
const lessonItem = z.strictObject({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['reading', 'video', 'exercise', 'quiz', 'file']).default('reading'),
  contentMd: z.string().trim().max(100_000).optional(),
});
export const createLessonBody = z.strictObject({
  weekNumber: z.number().int().min(1).max(52),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  kind: z.enum(['reading', 'document', 'video', 'exercise']).default('reading'),
  contentMd: z.string().trim().max(100_000).optional(),
  items: z.array(lessonItem).min(1).max(50),
});
