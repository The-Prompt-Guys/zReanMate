import test from 'node:test';
import assert from 'node:assert/strict';

import { quizAttemptStorageKey, shouldReuseStoredQuizAttempt } from './useQuizAttempt.js';

test('quiz attempt storage key includes the source id so different PDFs do not share one quiz', () => {
  const first = quizAttemptStorageKey('kit-10', 'pdf-1', 'en');
  const second = quizAttemptStorageKey('kit-10', 'pdf-2', 'en');

  assert.notEqual(first, second);
  assert.match(first, /pdf-1/);
  assert.match(second, /pdf-2/);
});

test('resetting the quiz forces a fresh generation instead of reusing the last submitted attempt', () => {
  assert.equal(shouldReuseStoredQuizAttempt('attempt-1', false), true);
  assert.equal(shouldReuseStoredQuizAttempt('attempt-1', true), false);
  assert.equal(shouldReuseStoredQuizAttempt(null, true), false);
});
