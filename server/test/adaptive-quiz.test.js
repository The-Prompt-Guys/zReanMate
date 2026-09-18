import test from 'node:test';
import assert from 'node:assert/strict';

import { balanceAnswerPositions, validateGeneratedQuiz } from '../src/services/quiz.service.js';
import { createMockProvider } from '../src/ai/mock.js';

const question = (overrides = {}) => ({
  kind: 'multiple_choice',
  prompt: 'What is a primary key?',
  options: ['A unique row identifier', 'A sort order', 'A foreign table', 'An index type'],
  correctAnswer: 0,
  explanation: 'The document defines it as the column identifying each row uniquely.',
  topic: 'Keys',
  ...overrides,
});

test('a question keeps the weak concept it was written to attack', () => {
  const quiz = validateGeneratedQuiz(
    { title: 'Adaptive Quiz - Databases', questions: [question({ targetedWeakConcept: ' Keys ' })] },
    1,
  );
  assert.equal(quiz.questions[0].targetedWeakConcept, 'Keys');
});

test('a question with no weak concept is recorded as general, not as an empty string', () => {
  const quiz = validateGeneratedQuiz({ title: 'Quiz', questions: [question()] }, 1);
  assert.equal(quiz.questions[0].targetedWeakConcept, null);

  const blank = validateGeneratedQuiz(
    { title: 'Quiz', questions: [question({ targetedWeakConcept: '   ' })] },
    1,
  );
  assert.equal(blank.questions[0].targetedWeakConcept, null);
});

test('an explanation is required, because a wrong answer with no reason teaches nothing', () => {
  assert.throws(
    () => validateGeneratedQuiz({ title: 'Quiz', questions: [question({ explanation: '' })] }, 1),
    /empty explanation/,
  );
});

test('a generated quiz aims about 70% of its questions at the weak topics it was given', async () => {
  const ai = createMockProvider();
  const quiz = await ai.generateQuiz({
    text: 'material',
    language: 'en',
    count: 10,
    weakTopics: ['Normalization', 'Keys'],
  });

  const targeted = quiz.questions.filter((q) => q.targetedWeakConcept);
  assert.equal(targeted.length, 7);
  assert.ok(targeted.every((q) => ['Normalization', 'Keys'].includes(q.targetedWeakConcept)));
  // Every question is four-option multiple choice, so rounds stay comparable.
  assert.ok(quiz.questions.every((q) => q.kind === 'multiple_choice' && q.options.length === 4));
});

test('with no history the questions spread out instead of targeting anything', async () => {
  const ai = createMockProvider();
  const quiz = await ai.generateQuiz({ text: 'material', language: 'en', count: 6 });
  assert.equal(quiz.questions.filter((q) => q.targetedWeakConcept).length, 0);
});

test('questions the student has already answered are not asked again', async () => {
  const ai = createMockProvider();
  const first = await ai.generateQuiz({ text: 'material', language: 'en', count: 8 });
  const seen = first.questions.map((q) => q.prompt);

  const second = await ai.generateQuiz({
    text: 'material',
    language: 'en',
    count: 8,
    avoidQuestions: seen,
  });

  assert.equal(second.questions.filter((q) => seen.includes(q.prompt)).length, 0);
});

const mcq = (i) => ({
  kind: 'multiple_choice',
  prompt: `Question ${i}`,
  // Every fixture has the answer first, which is exactly the bias the shuffle
  // exists to correct.
  options: [`right ${i}`, `wrong ${i}a`, `wrong ${i}b`, `wrong ${i}c`],
  correctAnswer: 0,
  explanation: 'because the document says so',
  topic: 'Topic',
});

test('correct answers are spread across all four positions, not left on A', () => {
  const balanced = balanceAnswerPositions(Array.from({ length: 10 }, (_, i) => mcq(i)));

  const counts = [0, 0, 0, 0];
  for (const question of balanced) counts[question.correctAnswer] += 1;

  assert.equal(counts.reduce((a, b) => a + b), 10);
  // A 10-question quiz cannot be perfectly even; every slot gets 2 or 3.
  assert.ok(counts.every((n) => n >= 2 && n <= 3), `unbalanced: ${counts.join('/')}`);
});

test('shuffling moves the index with the answer, so the right option is still right', () => {
  const balanced = balanceAnswerPositions(Array.from({ length: 12 }, (_, i) => mcq(i)));

  for (const [i, question] of balanced.entries()) {
    assert.equal(question.options[question.correctAnswer], `right ${i}`);
    assert.equal(new Set(question.options).size, 4, 'no option may be lost or duplicated');
  }
});

test('a written question has no position to shuffle and is left alone', () => {
  const written = {
    kind: 'written',
    prompt: 'Explain break-even volume.',
    options: [],
    correctAnswer: 'Fixed costs divided by contribution margin.',
    explanation: 'e',
    topic: 'Topic',
  };

  assert.deepEqual(balanceAnswerPositions([written]), [written]);
});

test('the shuffle is deterministic when the randomness is', () => {
  const questions = Array.from({ length: 8 }, (_, i) => mcq(i));
  const fixed = () => 0.42;

  assert.deepEqual(
    balanceAnswerPositions(questions, fixed),
    balanceAnswerPositions(questions, fixed),
  );
});
