import { z } from 'zod';
export const updateProfileBody = z.strictObject({
  fullName: z.string().trim().min(1).max(120).optional(),
  locale: z.enum(['km', 'en']).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Send at least one field' });

