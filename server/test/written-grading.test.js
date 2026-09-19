import test from 'node:test';
import assert from 'node:assert/strict';

import { createMockProvider } from '../src/ai/mock.js';

/**
 * What these guard: written answers used to be marked by lowercasing both
 * sides and testing them for equality, against the text of one multiple-choice
 * option. A student who conveyed the right idea in their own words was marked
 * wrong, and Khmer — which has no spaces between words — was never normalised
 * at all.
 *
 * The mock grader is crude by design. It is not trying to be a grader; it has
 * to be good enough that meaningfully different answers get different verdicts,
 * so the whole path can be exercised with no key configured. A grader that
 * always returned true would pass every wiring test while grading nothing.
 */

const ai = createMockProvider();

test('a right answer in different words is marked correct', async () => {
  const [grade] = await ai.gradeWrittenAnswers({
    language: 'en',
    answers: [{
      prompt: 'What does a primary key do?',
      expectedAnswer: 'It uniquely identifies each record in a table.',
      // Same meaning, different wording and word order — the exact case the old
      // string comparison failed.
      response: 'It identifies every record in a table uniquely',
    }],
  });
  assert.equal(grade.isCorrect, true);
  assert.ok(grade.note.trim().length > 0, 'a mark with no reason is not usable');
});

test('an unrelated answer is marked incorrect', async () => {
  const [grade] = await ai.gradeWrittenAnswers({
    language: 'en',
    answers: [{
      prompt: 'What does a primary key do?',
      expectedAnswer: 'It uniquely identifies each record in a table.',
      response: 'It stores pictures',
    }],
  });
  assert.equal(grade.isCorrect, false);
});

test('an empty answer is incorrect rather than vacuously correct', async () => {
  const [grade] = await ai.gradeWrittenAnswers({
    language: 'en',
    answers: [{
      prompt: 'What does a primary key do?',
      expectedAnswer: 'It uniquely identifies each record in a table.',
      response: '   ',
    }],
  });
  assert.equal(grade.isCorrect, false);
});

/**
 * Khmer has no spaces between words, so splitting on word boundaries finds
 * nothing to split and every Khmer answer would score zero overlap — marked
 * wrong however good it was.
 */
test('Khmer answers are graded rather than scoring zero on word boundaries', async () => {
  const expectedAnswer = 'គន្លឹះចម្បងកំណត់អត្តសញ្ញាណកំណត់ត្រា';
  const grades = await ai.gradeWrittenAnswers({
    language: 'km',
    answers: [
      { prompt: 'x', expectedAnswer, response: 'គន្លឹះចម្បងកំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗ' },
      { prompt: 'x', expectedAnswer, response: 'រូបភាព' },
    ],
  });
  assert.equal(grades[0].isCorrect, true, 'a correct Khmer answer was marked wrong');
  assert.equal(grades[1].isCorrect, false, 'an unrelated Khmer answer was marked right');
});

/**
 * The contract says grades come back in input order. That ordering is how each
 * mark finds its question, so a provider that broke it would silently award
 * every student the verdict belonging to somebody else's answer.
 */
test('grades come back one per answer, in order', async () => {
  const answers = [
    { prompt: 'a', expectedAnswer: 'Sodium hydroxide is the nucleophile.', response: 'Sodium hydroxide is the nucleophile.' },
    { prompt: 'b', expectedAnswer: 'Water is the solvent here.', response: 'completely unrelated text' },
    { prompt: 'c', expectedAnswer: 'Acetone is a ketone.', response: 'Acetone is a ketone.' },
  ];
  const grades = await ai.gradeWrittenAnswers({ answers, language: 'en' });

  assert.equal(grades.length, answers.length);
  assert.deepEqual(grades.map((g) => g.isCorrect), [true, false, true]);
});

test('no answers means no call and no grades', async () => {
  assert.deepEqual(await ai.gradeWrittenAnswers({ answers: [], language: 'en' }), []);
});

test('grading reports its token usage like every other generation', async () => {
  let reported = 0;
  await ai.gradeWrittenAnswers({
    language: 'en',
    answers: [{ prompt: 'a', expectedAnswer: 'b', response: 'c' }],
    onUsage: () => { reported += 1; },
  });
  assert.equal(reported, 1, 'a call that reports no usage looks free and is not');
});
