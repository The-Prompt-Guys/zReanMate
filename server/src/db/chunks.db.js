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

  /**
   * Nearest chunks to a question.
   *
   * `sourceId` narrows the search to one material. It is the difference
   * between a tutor that answers about the file you opened and one that
   * answers from whatever in the kit happened to match — which is how a
   * question about a PyQt6 chapter came back explaining fractional reserve
   * banking, cited to a file the student had not asked about.
   */
  async cosineSearchForKit({ kitId, embedding, limit = 3, sourceId = null }) {
    const { rows } = await query(
      `SELECT c.id, c.source_id, c.content, c.page_number,
              c.start_seconds, c.end_seconds, s.title,
              c.embedding <=> $2::vector AS distance
         FROM document_chunks c
         JOIN kit_sources s ON s.id = c.source_id
        WHERE c.study_kit_id = $1 AND c.embedding IS NOT NULL
          AND ($4::uuid IS NULL OR c.source_id = $4::uuid)
        ORDER BY c.embedding <=> $2::vector
        LIMIT $3`,
      [kitId, JSON.stringify(embedding), limit, sourceId],
    );
    return rows;
  },

  async deleteForSource(client, { sourceId }) {
    const runner = client ?? { query };
    await runner.query('DELETE FROM document_chunks WHERE source_id = $1', [sourceId]);
  },
};
