import test from 'node:test';
import assert from 'node:assert/strict';

import { validateGeneratedExam } from '../src/services/mockExam.service.js';
import { createMockProvider } from '../src/ai/mock.js';

const question = (overrides = {}) => ({
  kind: 'multiple_choice',
  prompt: 'Which reagent drives the substitution here?',
  options: ['Sodium hydroxide', 'Ethanol', 'Acetone', 'Water'],
  correctAnswer: 0,
  expectedAnswer: 'Sodium hydroxide, because the hydroxide ion is the nucleophile that attacks the carbon.',
  difficulty: 'medium',
  explanation: 'The document names hydroxide as the attacking nucleophile; the others are solvents.',
  topic: 'Substitution',
  ...overrides,
});

const exam = (questions) => ({ title: 'Mock Exam - Organic Chemistry', questions });

test('a valid exam question survives validation with its fields trimmed', () => {
  const result = validateGeneratedExam(
    exam([question({ prompt: '  Trailing space  ', expectedAnswer: '  Sodium hydroxide.  ' })]),
    1,
  );
  assert.equal(result.questions[0].prompt, 'Trailing space');
  assert.equal(result.questions[0].expectedAnswer, 'Sodium hydroxide.');
});

/**
 * The reason generateMockExam exists as its own method rather than reusing
 * generateQuiz: a written answer is marked against expectedAnswer, so an empty
 * one silently marks every response wrong. Strict json_schema does not catch it
 * — an empty string is a string.
 */
test('a question with no expectedAnswer is rejected, not stored', () => {
  assert.throws(
    () => validateGeneratedExam(exam([question({ expectedAnswer: '   ' })]), 1),
    /no expectedAnswer/,
  );
  assert.throws(
    () => validateGeneratedExam(exam([question({ expectedAnswer: undefined })]), 1),
    /no expectedAnswer/,
  );
});

test('a correct index pointing outside the options is rejected', () => {
  assert.throws(
    () => validateGeneratedExam(exam([question({ correctAnswer: 4 })]), 1),
    /out of range/,
  );
});

test('two options that read the same are rejected', () => {
  assert.throws(
    () => validateGeneratedExam(
      exam([question({ options: ['Sodium hydroxide', 'sodium  hydroxide', 'Acetone', 'Water'] })]),
      1,
    ),
    /duplicate options/,
  );
});

test('a short answer question must not carry choice options', () => {
  assert.throws(
    () => validateGeneratedExam(
      exam([question({ kind: 'short_answer', correctAnswer: 'Hydroxide' })]),
      1,
    ),
    /must not have choice options/,
  );
});

test('an unknown difficulty is rejected', () => {
  assert.throws(
    () => validateGeneratedExam(exam([question({ difficulty: 'brutal' })]), 1),
    /unknown difficulty/,
  );
});

test('a short bank is rejected rather than quietly producing a short exam', () => {
  assert.throws(
    () => validateGeneratedExam(exam([question(), question()]), 30),
    /expected exactly 30 questions, got 2/,
  );
});

/**
 * The bank has to outnumber the largest sitting the setup screen offers (20),
 * or the draw runs short and the student gets "Not enough generated questions
 * for those settings" — the error this feature replaces.
 */
test('the mock provider produces a full bank that passes validation', async () => {
  const ai = createMockProvider();
  const generated = await ai.generateMockExam({ text: 'material', title: 't', language: 'en', count: 30 });
  const validated = validateGeneratedExam(generated, 30);

  assert.equal(validated.questions.length, 30);
  assert.ok(validated.questions.every((q) => q.expectedAnswer.trim().length > 0));
  // 30 distinct prompts, not three repeated ten times.
  assert.equal(new Set(validated.questions.map((q) => q.prompt)).size, 30);
});

test('the mock bank is obviously fake in both languages', async () => {
  const ai = createMockProvider();
  for (const language of ['km', 'en']) {
    const generated = await ai.generateMockExam({ text: 'material', language, count: 5 });
    assert.ok(generated.title.includes('[MOCK]'), `${language} title is unmarked`);
    assert.ok(
      generated.questions.every((q) => q.prompt.includes('[MOCK]')),
      `${language} prompts are unmarked`,
    );
  }
});
