import { z } from 'zod';

const uuid = z.uuid('Not a valid id');
export const chatSessionParams = z.object({ sessionId: uuid });
export const chatKitParams = z.object({ kitId: uuid });
export const chatLanguageQuery = z.object({
  language: z.enum(['km', 'en']).default('km'),
  // Which material the thread is about. Omitted means the whole kit, which is
  // what the tutor has always been and still is when nothing is picked.
  sourceId: uuid.optional(),
});
export const createChatSchema = z.strictObject({
  kitId: uuid,
  sourceId: uuid.optional(),
  content: z.string().trim().min(1).max(4000),
  language: z.enum(['km', 'en']).default('km'),
});
export const explainChatSchema = z.strictObject({
  kitId: uuid,
  sourceId: uuid.optional(),
  content: z.string().trim().min(1).max(4000),
  language: z.enum(['km', 'en']).default('km'),
});
