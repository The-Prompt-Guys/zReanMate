import { basename } from 'node:path';

import { kitsDb } from '../db/kits.db.js';
import { sourcesDb } from '../db/sources.db.js';
import { extractVideoId } from '../ingest/youtube.js';
import { ApiError } from '../middleware/errors.js';
import {
  absoluteUploadPath,
  relativeUploadPath,
  removeUploadedFile,
  verifyUploadedFile,
} from '../middleware/upload.js';
import { ingestService } from './ingest.service.js';

const toApiSource = (row, { includeContent = false } = {}) => {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    kitId: row.study_kit_id,
    name: row.name || row.title,
    kind: row.kind,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    pageCount: row.page_count,
    durationSeconds: row.duration_seconds,
    sourceUrl: row.source_url,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    stage:
      metadata.stage ??
      (row.status === 'ready'
        ? 'ready'
        : row.status === 'processing'
          ? 'extracting'
          : 'reading'),
    progressPercent:
      metadata.progressPercent ??
      (row.status === 'ready'
        ? 100
        : row.status === 'processing'
          ? 50
          : 0),
    errorMessage: row.error_message,
    ...(includeContent && { extractedText: row.extracted_text }),
    createdAt: row.created_at,
  };
};

export const sourcesService = {
  async listForKit(userId, kitId) {
    const kit = await kitsDb.findById({ userId, kitId });
    if (!kit) throw ApiError.notFound('That study kit does not exist');

    const rows = await sourcesDb.listForKit({ userId, kitId });
    return rows.map(toApiSource);
  },

  async get(userId, kitId, sourceId) {
    const row = await sourcesDb.findById({ userId, kitId, sourceId });
    if (!row) throw ApiError.notFound('That file does not exist');
    return toApiSource(row, { includeContent: true });
  },

  /**
   * File upload creation (PDFs and images).
   */
  async createFromUpload(userId, kitId, file) {
    if (!file) throw ApiError.badRequest('No file was uploaded');

    try {
      const kit = await kitsDb.findById({ userId, kitId });
      if (!kit) throw ApiError.notFound('That study kit does not exist');

      // Magic-byte check.
      const { kind, byteSize } = await verifyUploadedFile(file);

      const inserted = await sourcesDb.create({
        kitId,
        userId,
        kind,
        title: basename(file.originalname),
        originalFilename: basename(file.originalname),
        storagePath: relativeUploadPath(file.path),
        mimeType: file.mimetype,
        byteSize,
        metadata: {
          stage: 'reading',
          progressPercent: 10,
        },
      });

      // Trigger background ingestion & embedding pipeline
      ingestService.enqueue(inserted.id);

      const row = await sourcesDb.findByIdUnscoped(inserted.id);
      return toApiSource(row);
    } catch (err) {
      await removeUploadedFile(file.path).catch(() => {});
      throw err;
    }
  },

  /**
   * JSON source creation (YouTube URL, topic, link, or text).
   */
  async createFromInput(userId, kitId, input = {}) {
    const kit = await kitsDb.findById({ userId, kitId });
    if (!kit) throw ApiError.notFound('That study kit does not exist');

    let inserted;

    if (input.kind === 'youtube') {
      const videoId = extractVideoId(input.url);
      inserted = await sourcesDb.create({
        kitId,
        userId,
        kind: 'youtube',
        title: input.title?.trim() || 'YouTube study kit',
        sourceUrl: input.url,
        youtubeVideoId: videoId,
        metadata: {
          stage: 'reading',
          progressPercent: 10,
        },
      });
    } else if (input.kind === 'topic') {
      const title = input.title?.trim() || 'Topic';
      inserted = await sourcesDb.create({
        kitId,
        userId,
        kind: 'topic',
        title,
        metadata: {
          stage: 'reading',
          progressPercent: 10,
        },
      });
    } else {
      throw ApiError.badRequest(`Unsupported source kind: "${input.kind}"`);
    }

    // Trigger background ingestion & embedding pipeline
    ingestService.enqueue(inserted.id);

    const row = await sourcesDb.findByIdUnscoped(inserted.id);
    return toApiSource(row);
  },

  async remove(userId, kitId, sourceId) {
    const row = await sourcesDb.deleteReturningPath({ userId, kitId, sourceId });
    if (!row) throw ApiError.notFound('That file does not exist');

    if (row.storage_path) {
      try {
        await removeUploadedFile(absoluteUploadPath(row.storage_path));
      } catch (err) {
        console.error(
          '[sources] deleted the row but could not remove',
          row.storage_path,
          err.message,
        );
      }
    }

    return { deleted: true };
  },
};
