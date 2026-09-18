import { profileDb } from '../db/profile.db.js';
import { ApiError } from '../middleware/errors.js';

const toProfile = (row) => ({
  id: row.id, fullName: row.full_name, email: row.email, phone: row.phone,
  avatarUrl: row.avatar_url, role: row.role, locale: row.locale,
  planTier: row.plan_tier, planStatus: row.plan_status,
  summary: { kits: row.kits, cards: row.cards, mastery: row.mastery },
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

