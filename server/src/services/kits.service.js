import { kitsDb } from '../db/kits.db.js';
import { withTransaction } from '../db/pool.js';
import { usersDb } from '../db/users.db.js';
import { ApiError } from '../middleware/errors.js';
import { absoluteUploadPath, removeUploadedFile } from '../middleware/upload.js';
import { plansService } from './plans.service.js';

/**
 * Study kits. Business logic lives here; routes only wire and controllers only
 * translate HTTP (CLAUDE.md, Hard rules).
 */

/** Round-robin defaults, matching what KitsContext did client-side. */
const ICONS = ['document', 'database', 'code', 'share'];
const ACCENTS = ['blue', 'violet', 'amber', 'teal'];

/** null means no cap. Free accounts are capped; Plus is not. */
/**
 * One shape for every kit the API returns, so the list, the detail read and the
 * create response cannot drift apart.
 */
const toApiKit = (row) => ({
  id: row.id,
  title: row.title,
  titleKm: row.title_km,
  description: row.description,
  subject: row.subject,
  icon: row.icon,
  accent: row.accent,
  status: row.status,
  progress: row.progress,
  cardCount: row.card_count,
  fileCount: row.file_count,
  sourceKind: row.source_kind,
  folderId: row.folder_id,
  lastStudiedAt: row.last_studied_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const kitsService = {
  async list(userId, { status, q } = {}) {
    const rows = await kitsDb.list({ userId, status, q });
    return rows.map(toApiKit);
  },

  async get(userId, kitId) {
    const row = await kitsDb.findById({ userId, kitId });
    // 404 rather than 403 for someone else's kit: a wrong-owner 403 confirms the
    // id exists, which is a small leak with no upside.
    if (!row) throw ApiError.notFound('That study kit does not exist');
    return toApiKit(row);
  },

  /** Current usage, for the quota card and for a pre-flight check. */
  async quota(userId) {
    const user = await usersDb.findById(userId);
    if (!user) throw ApiError.unauthorized('That account no longer exists');

    const limit = await plansService.getLimit(userId, 'max_kits');
    const used = await kitsDb.countForUser(userId);
    return { used, limit, planTier: user.plan_tier };
  },

  /**
   * The cap is counted inside the insert's transaction, behind a per-user
   * advisory lock. Without the lock two simultaneous creates both read "2 of 3"
   * and both insert, putting a free account at 4 kits — a check-then-act race
   * that a plain count outside a transaction cannot close.
   */
  async create(userId, input) {
    const user = await usersDb.findById(userId);
    if (!user) throw ApiError.unauthorized('That account no longer exists');

    const limit = await plansService.getLimit(userId, 'max_kits');

    const kitId = await withTransaction(async (client) => {
      // hashtextextended keeps the lock key inside bigint for any uuid.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [userId]);

      const used = await kitsDb.countForUser(userId, client);

      plansService.assertCapacity('max_kits', used, limit);

      return kitsDb.create(client, {
        userId,
        title: input.title,
        folderId: input.folderId,
        description: input.description,
        subject: input.subject,
        // Same rotation KitsContext used client-side, so a run of new kits still
        // comes out in four different colours rather than four blue ones.
        icon: input.icon ?? ICONS[used % ICONS.length],
        accent: input.accent ?? ACCENTS[used % ACCENTS.length],
      });
    });

    return this.get(userId, kitId);
  },

  async update(userId, kitId, patch) {
    const updated = await kitsDb.update({ userId, kitId, patch });
    if (!updated) throw ApiError.notFound('That study kit does not exist');
    return this.get(userId, kitId);
  },

  /**
   * Rows first, then files. kit_sources cascades from study_kits, so the rows
   * go in one statement; the paths are read inside the transaction because
   * after the commit there is nothing left to read them from.
   *
   * Unlinking after the commit means a disk error leaves an orphaned file
   * rather than a kit the user was told was deleted but still sees. The orphan
   * is logged and is recoverable; a half-deleted kit is neither.
   */
  async remove(userId, kitId) {
    const paths = await withTransaction((client) =>
      kitsDb.deleteReturningPaths(client, { userId, kitId }),
    );

    if (paths === null) throw ApiError.notFound('That study kit does not exist');

    const failed = [];
    for (const storagePath of paths) {
      try {
        await removeUploadedFile(absoluteUploadPath(storagePath));
      } catch (err) {
        failed.push(storagePath);
        console.error('[kits] deleted the kit but could not remove', storagePath, err.message);
      }
    }

    return { deleted: true, filesRemoved: paths.length - failed.length, filesOrphaned: failed.length };
  },
};
