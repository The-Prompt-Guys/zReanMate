import { query, queryOne } from './pool.js';

/**
 * SQL for `study_kits`. Parameterized only — no string interpolation
 * (CLAUDE.md, Database).
 *
 * Every read shapes the row for docs/API-CONTRACT.md §3 rather than returning
 * raw columns, because three of the fields the Kits tab needs are not columns:
 *
 *   cardCount   COUNT over flashcards      (contract D12)
 *   sourceKind  the kit's first source     (contract D11)
 *   titleKm     mirrors title for now      (contract D1)
 *
 * The lateral subqueries below are indexed — flashcards_study_kit_id_idx and
 * kit_sources_study_kit_id_idx — so the list stays one round trip rather than
 * a query per card.
 */

/**
 * `title_km` does not exist yet. D1 in the contract is the open decision about
 * whether authored text gets paired `_km` columns; until it is settled the API
 * mirrors the single title so a Khmer reader sees the kit name rather than a
 * blank card. KitsContext.addKit already behaves this way client-side, so the
 * mirror is what the screens have always been fed.
 *
 * `shortTitle` is deliberately absent, not mirrored: KitCard falls back to the
 * full title when it is undefined, which is the correct narrow-column
 * behaviour. Mirroring would defeat that fallback.
 */
const KIT_SELECT = `
  SELECT
    k.id,
    k.title,
    k.title              AS title_km,
    k.description,
    k.subject,
    k.icon,
    k.accent_color       AS accent,
    k.status,
    k.progress_percent   AS progress,
    k.folder_id,
    k.last_studied_at,
    k.created_at,
    k.updated_at,
    (SELECT count(*) FROM flashcards f WHERE f.study_kit_id = k.id)::int AS card_count,
    (SELECT count(*) FROM kit_sources s WHERE s.study_kit_id = k.id)::int AS file_count,
    -- D11: the kit badge shows one kind for a kit that may hold several. Taking
    -- the earliest source matches "what the kit was created from", which is how
    -- every create flow in the client actually works.
    (SELECT s.kind FROM kit_sources s
      WHERE s.study_kit_id = k.id
      ORDER BY s.created_at ASC, s.id ASC
      LIMIT 1) AS source_kind
  FROM study_kits k
`;

export const kitsDb = {
  /**
   * `q` searches with pg_trgm similarity, never to_tsvector: Khmer has no word
   * spaces and ships no dictionary, so the default tokenizer collapses a whole
   * title into one lexeme and the search silently returns nothing (CLAUDE.md).
   *
   * ILIKE handles the substring case that trigram similarity scores poorly on
   * very short queries; the similarity term is what makes a typo still match.
   */
  async list({ userId, status, q }) {
    const { rows } = await query(
      `${KIT_SELECT}
        WHERE k.user_id = $1
          AND ($2::text IS NULL OR k.status = $2)
          AND (
            $3::text IS NULL
            OR k.title ILIKE '%' || $3 || '%'
            OR similarity(k.title, $3) > 0.15
          )
        ORDER BY k.last_studied_at DESC NULLS LAST, k.created_at DESC`,
      [userId, status ?? null, q ?? null],
    );
    return rows;
  },

  async findById({ userId, kitId }) {
    return queryOne(`${KIT_SELECT} WHERE k.id = $1 AND k.user_id = $2`, [kitId, userId]);
  },

  /**
   * Current personal-kit count for the plan cap. A class_id marks a kit shared
   * into a class, so it is deliberately exempt from a student's three-kit cap.
   */
  async countForUser(userId, client) {
    const runner = client ?? { query };
    const { rows } = await runner.query(
      `SELECT count(*)::int AS count
         FROM study_kits
        WHERE user_id = $1 AND class_id IS NULL`,
      [userId],
    );
    return rows[0].count;
  },

  /**
   * Takes a client so the caller can run the cap check and the insert inside
   * one transaction — see kits.service.js.
   */
  async create(client, { userId, title, folderId, icon, accent, description, subject }) {
    const { rows } = await client.query(
      `INSERT INTO study_kits (user_id, folder_id, title, description, subject, icon, accent_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userId, folderId ?? null, title, description ?? null, subject ?? null, icon, accent],
    );
    return rows[0].id;
  },

  /**
   * Only the named columns can be written, and COALESCE means an omitted field
   * keeps its current value — a PATCH with one key must not blank the rest.
   */
  async update({ userId, kitId, patch }) {
    return queryOne(
      `UPDATE study_kits SET
         title            = COALESCE($3, title),
         description      = COALESCE($4, description),
         subject          = COALESCE($5, subject),
         icon             = COALESCE($6, icon),
         accent_color     = COALESCE($7, accent_color),
         status           = COALESCE($8, status),
         progress_percent = COALESCE($9, progress_percent),
         folder_id        = CASE WHEN $10::boolean THEN $11::uuid ELSE folder_id END
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [
        kitId,
        userId,
        patch.title ?? null,
        patch.description ?? null,
        patch.subject ?? null,
        patch.icon ?? null,
        patch.accent ?? null,
        patch.status ?? null,
        patch.progress ?? null,
        // folderId is explicitly nullable — "move to no folder" is a real edit,
        // so a sent null must win over COALESCE rather than mean "unchanged".
        Object.hasOwn(patch, 'folderId'),
        patch.folderId ?? null,
      ],
    );
  },

  /**
   * Returns the storage paths of everything the cascade is about to remove, so
   * the service can unlink the files after the rows are gone.
   */
  async deleteReturningPaths(client, { userId, kitId }) {
    const { rows: owned } = await client.query(
      'SELECT id FROM study_kits WHERE id = $1 AND user_id = $2',
      [kitId, userId],
    );
    if (owned.length === 0) return null;

    const { rows: paths } = await client.query(
      `SELECT storage_path FROM kit_sources
        WHERE study_kit_id = $1 AND storage_path IS NOT NULL`,
      [kitId],
    );

    await client.query('DELETE FROM study_kits WHERE id = $1 AND user_id = $2', [kitId, userId]);

    return paths.map((row) => row.storage_path);
  },
};
