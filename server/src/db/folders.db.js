import { query, queryOne } from './pool.js';

/**
 * SQL for `study_folders`.
 *
 * Note for whoever picks this up: no screen reads folders yet.
 * docs/API-CONTRACT.md §3 records that `/kits/folders/new` — despite the path —
 * renders CreateKitSheet and creates a *kit*. This module exists so folders are
 * available when a screen wants them; it is not currently on any path the
 * client walks.
 */

const FOLDER_SELECT = `
  SELECT
    f.id,
    f.name,
    f.color,
    f.icon,
    f.sort_order,
    f.created_at,
    f.updated_at,
    (SELECT count(*) FROM study_kits k WHERE k.folder_id = f.id)::int AS kit_count
  FROM study_folders f
`;

export const foldersDb = {
  async list(userId) {
    const { rows } = await query(
      `${FOLDER_SELECT} WHERE f.user_id = $1 ORDER BY f.sort_order ASC, f.created_at ASC`,
      [userId],
    );
    return rows;
  },

  async findById({ userId, folderId }) {
    return queryOne(`${FOLDER_SELECT} WHERE f.id = $1 AND f.user_id = $2`, [folderId, userId]);
  },

  async create({ userId, name, color, icon, sortOrder }) {
    return queryOne(
      `INSERT INTO study_folders (user_id, name, color, icon, sort_order)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0))
       RETURNING id`,
      [userId, name, color ?? null, icon ?? null, sortOrder ?? null],
    );
  },

  async update({ userId, folderId, patch }) {
    return queryOne(
      `UPDATE study_folders SET
         name       = COALESCE($3, name),
         color      = COALESCE($4, color),
         icon       = COALESCE($5, icon),
         sort_order = COALESCE($6, sort_order)
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [
        folderId,
        userId,
        patch.name ?? null,
        patch.color ?? null,
        patch.icon ?? null,
        patch.sortOrder ?? null,
      ],
    );
  },

  /**
   * study_kits.folder_id is ON DELETE SET NULL, so deleting a folder unfiles
   * its kits rather than destroying them. That is the right default: a folder
   * is an organising device, and nobody expects tidying to delete their work.
   */
  async remove({ userId, folderId }) {
    return queryOne('DELETE FROM study_folders WHERE id = $1 AND user_id = $2 RETURNING id', [
      folderId,
      userId,
    ]);
  },
};
