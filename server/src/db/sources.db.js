import { query, queryOne } from './pool.js';

/**
 * SQL for `kit_sources` — uploaded files, YouTube links, and typed topics.
 */

const SOURCE_SELECT = `
  SELECT
    s.id,
    s.study_kit_id,
    s.user_id,
    s.title              AS name,
    s.kind,
    s.original_filename,
    s.mime_type,
    s.byte_size,
    s.page_count,
    s.duration_seconds,
    s.source_url,
    s.youtube_video_id,
    s.thumbnail_url,
    s.extracted_text,
    s.status,
    s.error_message,
    s.storage_path,
    s.metadata,
    s.processed_at,
    s.created_at,
    s.updated_at
  FROM kit_sources s
`;

export const sourcesDb = {
  async listForKit({ userId, kitId }) {
    const { rows } = await query(
      `${SOURCE_SELECT}
        JOIN study_kits k ON k.id = s.study_kit_id
        WHERE s.study_kit_id = $1 AND k.user_id = $2
        ORDER BY s.created_at DESC, s.id DESC`,
      [kitId, userId],
    );
    return rows;
  },

  async findById({ userId, kitId, sourceId }) {
    return queryOne(
      `${SOURCE_SELECT}
        JOIN study_kits k ON k.id = s.study_kit_id
        WHERE s.id = $1 AND s.study_kit_id = $2 AND k.user_id = $3`,
      [sourceId, kitId, userId],
    );
  },

  async findByIdUnscoped(sourceId) {
    return queryOne(`${SOURCE_SELECT} WHERE s.id = $1`, [sourceId]);
  },

  async findAccessibleById({ userId, sourceId }) {
    return queryOne(
      `${SOURCE_SELECT}
        JOIN study_kits k ON k.id = s.study_kit_id
        WHERE s.id = $1 AND (
          k.user_id = $2 OR EXISTS (
            SELECT 1 FROM class_enrollments ce
             WHERE ce.class_id = k.class_id AND ce.user_id = $2 AND ce.status = 'active'
          )
        )`,
      [sourceId, userId],
    );
  },

  async create({
    kitId,
    userId,
    kind,
    title,
    originalFilename,
    storagePath,
    mimeType,
    byteSize,
    sourceUrl,
    youtubeVideoId,
    durationSeconds,
    thumbnailUrl,
    metadata = {},
  }) {
    return queryOne(
      `INSERT INTO kit_sources
         (study_kit_id, user_id, kind, title, original_filename,
          storage_path, mime_type, byte_size, source_url,
          youtube_video_id, duration_seconds, thumbnail_url,
          status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13)
       RETURNING id`,
      [
        kitId,
        userId,
        kind,
        title,
        originalFilename ?? null,
        storagePath ?? null,
        mimeType ?? null,
        byteSize ?? null,
        sourceUrl ?? null,
        youtubeVideoId ?? null,
        durationSeconds ?? null,
        thumbnailUrl ?? null,
        JSON.stringify(metadata),
      ],
    );
  },

  /**
   * Updates status, progress, stage metadata, and extracted metrics.
   */
  async updateStatus(sourceId, patch = {}) {
    const current = await this.findByIdUnscoped(sourceId);
    if (!current) return null;

    const mergedMetadata = {
      ...(current.metadata || {}),
      ...(patch.metadata || {}),
      ...(patch.stage !== undefined && { stage: patch.stage }),
      ...(patch.progressPercent !== undefined && { progressPercent: patch.progressPercent }),
    };

    return queryOne(
      `UPDATE kit_sources SET
         status           = COALESCE($2, status),
         error_message    = $3,
         page_count       = COALESCE($4, page_count),
         duration_seconds = COALESCE($5, duration_seconds),
         extracted_text   = COALESCE($6, extracted_text),
         thumbnail_url    = COALESCE($7, thumbnail_url),
         processed_at     = CASE WHEN $8::boolean THEN now() ELSE processed_at END,
         metadata         = $9
       WHERE id = $1
       RETURNING id`,
      [
        sourceId,
        patch.status ?? null,
        patch.errorMessage !== undefined ? patch.errorMessage : current.error_message,
        patch.pageCount ?? null,
        patch.durationSeconds ?? null,
        patch.extractedText ?? null,
        patch.thumbnailUrl ?? null,
        patch.status === 'ready',
        JSON.stringify(mergedMetadata),
      ],
    );
  },

  async deleteReturningPath({ userId, kitId, sourceId }) {
    const row = await queryOne(
      `DELETE FROM kit_sources s
        USING study_kits k
        WHERE s.id = $1
          AND s.study_kit_id = $2
          AND k.id = s.study_kit_id
          AND k.user_id = $3
        RETURNING s.storage_path`,
      [sourceId, kitId, userId],
    );
    return row;
  },
};
