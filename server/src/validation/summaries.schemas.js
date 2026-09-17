import { z } from 'zod';

export const summarySourceParams = z.object({ id: z.uuid('Not a valid source id') });
export const summarizeBody = z.strictObject({ language: z.enum(['km', 'en']).default('km') });
export const chaptersBody = z.strictObject({
  language: z.enum(['km', 'en']).default('km'),
  chapterCount: z.number().int().min(2).max(24).default(12),
});
export const studyGuideBody = z.strictObject({
  language: z.enum(['km', 'en']).default('km'),
  // Eight is roughly a lecture's worth of distinct concepts. The cap is what a
  // single document can carry before modules start splitting hairs; the floor
  // keeps a one-page handout from being cut into fragments.
  moduleCount: z.number().int().min(2).max(16).default(8),
});
