import assert from 'node:assert/strict';
import test from 'node:test';

import { calendarMonthUtc, createPlansService, hasPlanCapacity } from '../src/services/plans.service.js';

const fakeDb = ({ limit = 20, initial = {} } = {}) => {
  const counters = new Map(Object.entries(initial));
  return {
    counters,
    async consume({ counterKey, periodStart, amount }) {
      const key = `${counterKey}:${periodStart}`;
      const used = counters.get(key) ?? 0;
      if (limit !== null && used + amount > limit) return null;
      counters.set(key, used + amount);
      return { quantity: used + amount, limit_value: limit };
    },
    async limit() { return { limit_value: limit }; },
  };
};

test('quota boundary permits the last unit and denies the next', async () => {
  const db = fakeDb({ initial: { 'tutor_messages_per_month:2026-09-01': 19 } });
  const service = createPlansService(db);
  assert.equal((await service.consumeQuota('u', 'tutor_messages_per_month', 1, new Date('2026-09-30T23:00:00Z'))).used, 20);
  await assert.rejects(service.consumeQuota('u', 'tutor_messages_per_month', 1, new Date('2026-09-30T23:00:00Z')), (error) => error.code === 'quota_exceeded');
});

test('two concurrent consumes at the boundary yield exactly one success', async () => {
  const db = fakeDb({ initial: { 'tutor_messages_per_month:2026-09-01': 19 } });
  const service = createPlansService(db);
  const results = await Promise.allSettled([
    service.consumeQuota('u', 'tutor_messages_per_month', 1, new Date('2026-09-20T00:00:00Z')),
    service.consumeQuota('u', 'tutor_messages_per_month', 1, new Date('2026-09-20T00:00:00Z')),
  ]);
  assert.deepEqual(results.map((item) => item.status).sort(), ['fulfilled', 'rejected']);
});

test('calendar month rollover uses a fresh UTC counter key', async () => {
  const db = fakeDb({ initial: { 'tutor_messages_per_month:2026-09-01': 20 } });
  const service = createPlansService(db);
  const quota = await service.consumeQuota('u', 'tutor_messages_per_month', 1, new Date('2026-10-01T00:00:00Z'));
  assert.equal(quota.periodStart, '2026-10-01');
  assert.equal(quota.used, 1);
  assert.equal(calendarMonthUtc(new Date('2026-09-30T23:59:59Z')), '2026-09-01');
});

test('deleting a personal kit immediately frees a slot', () => {
  assert.equal(hasPlanCapacity(3, 3), false);
  assert.equal(hasPlanCapacity(2, 3), true);
});

test('a failed handler does not consume quota', async () => {
  const db = fakeDb();
  const service = createPlansService(db);
  await assert.rejects(service.afterSuccess('u', 'tutor_messages_per_month', async () => { throw new Error('failed'); }));
  assert.equal(db.counters.size, 0);
});

