import { z } from 'zod';

const uuid = z.uuid('Not a valid id');
export const chatSessionParams = z.object({ sessionId: uuid });
export const chatKitParams = z.object({ kitId: uuid });
export const chatLanguageQuery = z.object({ language: z.enum(['km', 'en']).default('km') });
export const createChatSchema = z.strictObject({
  kitId: uuid,
  content: z.string().trim().min(1).max(4000),
  language: z.enum(['km', 'en']).default('km'),
});
