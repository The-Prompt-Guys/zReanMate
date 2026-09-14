import { foldersDb } from '../db/folders.db.js';
import { ApiError } from '../middleware/errors.js';

/**
 * Study folders.
 *
 * No screen calls this yet — see the note in db/folders.db.js and
 * docs/API-CONTRACT.md §3. It is here so the table has a front door.
 */

const toApiFolder = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  icon: row.icon,
  sortOrder: row.sort_order,
  kitCount: row.kit_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const foldersService = {
  async list(userId) {
    const rows = await foldersDb.list(userId);
    return rows.map(toApiFolder);
  },

  async get(userId, folderId) {
    const row = await foldersDb.findById({ userId, folderId });
    if (!row) throw ApiError.notFound('That folder does not exist');
    return toApiFolder(row);
  },

  async create(userId, input) {
    const { id } = await foldersDb.create({ userId, ...input });
    return this.get(userId, id);
  },

  async update(userId, folderId, patch) {
    const updated = await foldersDb.update({ userId, folderId, patch });
    if (!updated) throw ApiError.notFound('That folder does not exist');
    return this.get(userId, folderId);
  },

  /** Kits inside are unfiled, not deleted — study_kits.folder_id is SET NULL. */
  async remove(userId, folderId) {
    const removed = await foldersDb.remove({ userId, folderId });
    if (!removed) throw ApiError.notFound('That folder does not exist');
    return { deleted: true };
  },
};
