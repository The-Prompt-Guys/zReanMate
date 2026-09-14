import assert from 'node:assert/strict';
import test from 'node:test';

import { scheduleSm2Review } from '../src/services/sm2.js';

const start = new Date('2026-01-01T12:00:00.000Z');

test('the first three successful reviews schedule 1, 6, then 16 days', () => {
  const first = scheduleSm2Review(undefined, 5, start);
  assert.deepEqual(first, {
    easeFactor: 2.6,
    intervalDays: 1,
    repetitions: 1,
    lapses: 0,
    dueAt: new Date('2026-01-02T12:00:00.000Z'),
    lastReviewedAt: start,
  });

  const secondAt = first.dueAt;
  const second = scheduleSm2Review(first, 5, secondAt);
  assert.equal(second.intervalDays, 6);
  assert.equal(second.repetitions, 2);
  assert.equal(second.easeFactor, 2.7);
  assert.deepEqual(second.dueAt, new Date('2026-01-08T12:00:00.000Z'));

  const thirdAt = second.dueAt;
  const third = scheduleSm2Review(second, 5, thirdAt);
  assert.equal(third.intervalDays, 16);
  assert.equal(third.repetitions, 3);
  assert.equal(third.easeFactor, 2.8);
  assert.deepEqual(third.dueAt, new Date('2026-01-24T12:00:00.000Z'));
});

test('a lapse resets repetitions and interval while incrementing lapses', () => {
  const result = scheduleSm2Review({
    easeFactor: 2.8,
    intervalDays: 16,
    repetitions: 3,
    lapses: 0,
  }, 2, start);

  assert.equal(result.intervalDays, 1);
  assert.equal(result.repetitions, 0);
  assert.equal(result.lapses, 1);
  assert.equal(result.easeFactor, 2.48);
  assert.deepEqual(result.dueAt, new Date('2026-01-02T12:00:00.000Z'));
});

test('ease factor never falls below the 1.3 floor', () => {
  const first = scheduleSm2Review({
    easeFactor: 1.31,
    intervalDays: 1,
    repetitions: 0,
    lapses: 4,
  }, 0, start);
  const second = scheduleSm2Review(first, 0, first.dueAt);

  assert.equal(first.easeFactor, 1.3);
  assert.equal(second.easeFactor, 1.3);
  assert.equal(second.lapses, 6);
});

test('quality must be an integer from 0 through 5', () => {
  assert.throws(() => scheduleSm2Review(undefined, -1, start), RangeError);
  assert.throws(() => scheduleSm2Review(undefined, 6, start), RangeError);
  assert.throws(() => scheduleSm2Review(undefined, 3.5, start), RangeError);
});

