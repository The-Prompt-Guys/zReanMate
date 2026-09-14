import { z } from 'zod';

export const summarySourceParams = z.object({ id: z.uuid('Not a valid source id') });
export const summarizeBody = z.strictObject({ language: z.enum(['km', 'en']).default('km') });
export const chaptersBody = z.strictObject({
  language: z.enum(['km', 'en']).default('km'),
  chapterCount: z.number().int().min(2).max(24).default(12),
});
