import { z } from 'zod';

import { SURVEY_QUESTIONS } from '../services/onboarding.service.js';

/**
 * Request schemas. Every endpoint validates against one of these before the
 * controller runs (CLAUDE.md, Hard rules).
 */

const MIN_PASSWORD = 8;

// Digits with an optional leading +, once separators are stripped. Deliberately
// loose — students paste numbers in several formats and a strict national
// pattern would reject valid ones.
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-().]/g, ''))
  .refine((value) => /^\+?\d{8,15}$/.test(value), 'Enter a valid phone number');

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Enter your name').max(120),
    email: emailSchema.optional(),
    // Optional per docs/screens/01-auth-onboarding/01 ("Phone number(optional)").
    phone: phoneSchema.optional(),
    password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters`).max(200),
    locale: z.enum(['km', 'en']).optional(),
  })
  // Mirrors the users_needs_identifier CHECK added in migration 002.
  .refine((data) => Boolean(data.email || data.phone), {
    message: 'Provide an email address or a phone number',
    path: ['email'],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or phone number'),
  password: z.string().min(1, 'Enter your password'),
});

export const roleSchema = z.object({
  role: z.enum(['student', 'teacher']),
});

/**
 * Every answer is optional because each survey screen submits on its own and
 * "Skip" is available on all three. `complete` marks the run finished.
 */
export const surveySchema = z.object({
  // strictObject, not object: a plain object SILENTLY STRIPS unknown keys, so a
  // misspelled answer would save as {} and return 200 with the answer dropped.
  // Rejecting instead turns a client typo into a 422 the developer can see.
  answers: z
    .strictObject({
      improveFirst: z.enum(SURVEY_QUESTIONS.improveFirst).optional(),
      studyStyle: z.enum(SURVEY_QUESTIONS.studyStyle).optional(),
      studyFrequency: z.enum(SURVEY_QUESTIONS.studyFrequency).optional(),
    })
    .default({}),
  skipped: z.boolean().default(false),
  complete: z.boolean().default(false),
});
