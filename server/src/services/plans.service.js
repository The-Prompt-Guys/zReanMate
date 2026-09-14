import { plansDb } from '../db/plans.db.js';
import { ApiError } from '../middleware/errors.js';

export const calendarMonthUtc = (date = new Date()) => {
  const value = new Date(date);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-01`;
};
export const hasPlanCapacity = (used, limit, amount = 1) => limit === null || used + amount <= limit;

export const createPlansService = (db = plansDb) => ({
  async consumeQuota(userId, counterKey, amount = 1, now = new Date()) {
    const periodStart = calendarMonthUtc(now);
    const consumed = await db.consume({ userId, counterKey, periodStart, amount });
    if (!consumed) {
      const configured = await db.limit(userId, counterKey);
      const details = { limit: configured?.limit_value ?? null };
      throw new ApiError(429, 'quota_exceeded', 'Plan quota exceeded', details);
    }
    const limit = consumed.limit_value;
    return { used: consumed.quantity, limit, remaining: limit === null ? null : Math.max(0, limit - consumed.quantity), periodStart };
  },
  async getLimit(userId, key) {
    const row = await db.limit(userId, key);
    if (!row) throw new ApiError(403, 'feature_unavailable', 'This limit is not configured for the plan', { requiredPlan: 'plus' });
    return row.limit_value;
  },
  assertCapacity(key, used, limit, amount = 1) {
    if (!hasPlanCapacity(used, limit, amount)) {
      throw new ApiError(403, 'quota_exceeded', 'Plan quota exceeded', { key, used, limit });
    }
  },
  async requireFeature(userId, key) {
    const row = await db.feature(userId, key);
    if (!row?.enabled) throw new ApiError(403, 'feature_unavailable', 'This feature is unavailable on the current plan', { requiredPlan: 'plus' });
  },
  async limits(userId, now = new Date()) {
    const periodStart = calendarMonthUtc(now);
    const row = await db.all(userId, periodStart);
    if (!row) throw ApiError.unauthorized();
    const expectedLimits = ['max_kits', 'tutor_messages_per_month', 'practice_sessions_per_week'];
    const expectedFeatures = ['chapter_summaries', 'mock_exams'];
    if (expectedLimits.some((key) => !Object.hasOwn(row.limits, key)) ||
        expectedFeatures.some((key) => !Object.hasOwn(row.features, key))) {
      throw new ApiError(403, 'feature_unavailable', 'Plan configuration is incomplete', { requiredPlan: 'plus' });
    }
    const limits = Object.fromEntries(Object.entries(row.limits).map(([key, value]) => [key, {
      ...value, remaining: value.limit === null ? null : Math.max(0, value.limit - value.used),
    }]));
    const catalog = await db.catalog();
    const plans = { free: { limits: {}, features: {} }, plus: { limits: {}, features: {} } };
    for (const item of catalog.limits) plans[item.plan_tier].limits[item.limit_key] = item.limit_value;
    for (const item of catalog.features) plans[item.plan_tier].features[item.feature_key] = item.enabled;
    return { planTier: row.plan_tier, periodStart, limits, features: row.features, plans };
  },
  async generationCount(userId, kind) {
    const row = await db.tier(userId);
    if (!row) throw ApiError.unauthorized();
    const policy = {
      quiz: { free: 10, plus: 25 },
      flashcards: { free: 20, plus: 40 },
    }[kind];
    if (!policy || policy[row.plan_tier] === undefined) {
      throw new ApiError(403, 'feature_unavailable', 'Generation policy is missing', { requiredPlan: 'plus' });
    }
    return policy[row.plan_tier];
  },
  async afterSuccess(userId, counterKey, handler) {
    const result = await handler();
    const quota = await this.consumeQuota(userId, counterKey);
    return { result, quota };
  },
});

export const plansService = createPlansService();
