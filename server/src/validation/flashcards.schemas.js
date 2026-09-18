import { z } from 'zod';

const uuid = z.uuid('Not a valid id');
export const flashcardSourceParams = z.object({ id: uuid });
export const flashcardParams = z.object({ id: uuid });
export const generateFlashcardsBody = z.strictObject({
  language: z.enum(['km', 'en']).default('km'),
  regenerate: z.boolean().default(false),
  round: z.number().int().positive().optional(),
});
export const dueFlashcardsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kitId: uuid.optional(),
  // Reviewing one material returns only the cards generated from it. The two
  // filters compose: kitId alone is the whole kit, as the Practice tab wants.
  sourceId: uuid.optional(),
});
export const reviewFlashcardBody = z.strictObject({
  quality: z.number().int().min(0).max(5),
});

