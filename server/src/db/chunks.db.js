import { query } from './pool.js';

/**
 * SQL for `document_chunks`.
 *
 * Stores retrieval corpus chunks with 1536-dimensional embeddings and citation
 * anchors (page_number for PDFs, start_seconds/end_seconds for transcripts).
 */

export const chunksDb = {
  /**
   * Batch insert chunks in a single transaction.
   *
   * @param {Object} client - Transaction client from withTransaction
   * @param {Object} params
   * @param {string} params.sourceId
   * @param {string} params.studyKitId
   * @param {Array<Object>} params.chunks
   */
  async insertBatch(client, { sourceId, studyKitId, chunks }) {
    if (!chunks || chunks.length === 0) return [];

    const inserted = [];

    for (const chunk of chunks) {
      const embeddingSql = chunk.embedding ? JSON.stringify(chunk.embedding) : null;

      const { rows } = await client.query(
        `INSERT INTO document_chunks (
           source_id, study_kit_id, chunk_index, content, token_count,
           page_number, start_seconds, end_seconds, embedding, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10)
         RETURNING id, chunk_index`,
        [
          sourceId,
          studyKitId,
          chunk.chunkIndex,
          chunk.content,
          chunk.tokenCount ?? null,
          chunk.pageNumber ?? null,
          chunk.startSeconds ?? null,
          chunk.endSeconds ?? null,
          embeddingSql,
          JSON.stringify(chunk.metadata ?? {}),
        ],
      );

      inserted.push(rows[0]);
    }

    return inserted;
  },

  async listForSource({ sourceId }) {
    const { rows } = await query(
      `SELECT
         id, source_id, study_kit_id, chunk_index, content,
         token_count, page_number, start_seconds, end_seconds,
         metadata, created_at
       FROM document_chunks
       WHERE source_id = $1
       ORDER BY chunk_index ASC`,
      [sourceId],
    );
    return rows;
  },

  async countForSource(sourceId) {
    const { rows } = await query(
      'SELECT count(*)::int AS count FROM document_chunks WHERE source_id = $1',
      [sourceId],
    );
    return rows[0]?.count ?? 0;
  },

  async cosineSearchForKit({ kitId, embedding, limit = 3 }) {
    const { rows } = await query(
      `SELECT c.id, c.source_id, c.content, c.page_number,
              c.start_seconds, c.end_seconds, s.title,
              c.embedding <=> $2::vector AS distance
         FROM document_chunks c
         JOIN kit_sources s ON s.id = c.source_id
        WHERE c.study_kit_id = $1 AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> $2::vector
        LIMIT $3`,
      [kitId, JSON.stringify(embedding), limit],
    );
    return rows;
  },

  async deleteForSource(client, { sourceId }) {
    const runner = client ?? { query };
    await runner.query('DELETE FROM document_chunks WHERE source_id = $1', [sourceId]);
  },
};
