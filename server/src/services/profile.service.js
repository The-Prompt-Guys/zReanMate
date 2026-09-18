import { profileDb } from '../db/profile.db.js';
import { ApiError } from '../middleware/errors.js';

const streakFor = (values = []) => {
  const days = new Set(values.map((value) => String(value).slice(0, 10)));
  const cursor = new Date();
  let streak = 0;

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
};

const toProfile = (row) => ({
  id: row.id, fullName: row.full_name, email: row.email, phone: row.phone,
  avatarUrl: row.avatar_url, role: row.role, locale: row.locale,
  planTier: row.plan_tier, planStatus: row.plan_status,
  summary: { kits: row.kits, streak: streakFor(row.activity_days), mastery: row.mastery },
  activityDays: row.activity_days,
});
export const profileService = {
  async get(userId) {
    const row = await profileDb.get(userId);
    if (!row) throw ApiError.unauthorized();
    return { profile: toProfile(row) };
  },
  async update(userId, patch) {
    if (!await profileDb.update(userId, patch)) throw ApiError.unauthorized();
    return this.get(userId);
  },
  async deleteAccount(userId) {
    if (!await profileDb.deleteAccount(userId)) {
      throw ApiError.unauthorized('That account is no longer active');
    }

    return { deleted: true };
  },
};

