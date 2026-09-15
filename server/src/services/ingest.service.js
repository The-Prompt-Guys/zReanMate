import { chunksDb } from '../db/chunks.db.js';
import { withTransaction } from '../db/pool.js';
import { sourcesDb } from '../db/sources.db.js';
import { usersDb } from '../db/users.db.js';
import { chunkPdfPages, chunkText, chunkYouTubeTranscript } from '../ingest/chunker.js';
import { INGEST_ERROR_CODES, IngestError } from '../ingest/errors.js';
import { extractPdf } from '../ingest/pdf.js';
import { ingestYouTube } from '../ingest/youtube.js';
import { jobQueue } from '../jobs/queue.js';
import { absoluteUploadPath } from '../middleware/upload.js';
import { detectCostLanguage, trackGeneration } from './aiUsage.service.js';

/**
 * Ingest pipeline service:
 * 1. Text extraction with citation preservation (PDF pageNumber / YouTube timestamps)
 * 2. Pre-token plan limits enforcement (50-page PDF / 30-min YouTube for Free plan)
 * 3. Token-aware chunking (~500 tokens with overlap)
 * 4. Batched embeddings via the AI layer, recorded in ai_generations
 * 5. Vector persistence in document_chunks
 */

export const ingestService = {
  /**
   * Enqueues source processing in the background.
   */
  enqueue(sourceId) {
    jobQueue.enqueue('source:ingest', { sourceId });
  },

  /**
   * Runs the full ingest pipeline for one source.
   */
  async processSource(sourceId) {
    const source = await sourcesDb.findByIdUnscoped(sourceId);
    if (!source) {
      console.warn(`[ingest] source "${sourceId}" not found, skipping`);
      return;
    }

    const user = await usersDb.findById(source.user_id);
    const planTier = user?.plan_tier || 'free';

    try {
      // Step 1: Update status to processing / extracting
      await sourcesDb.updateStatus(sourceId, {
        status: 'processing',
        stage: 'extracting',
        progressPercent: 20,
        errorMessage: null,
      });

      let chunks = [];
      let metrics = {};

      if (source.kind === 'pdf') {
        if (!source.storage_path) {
          throw new IngestError(INGEST_ERROR_CODES.EXTRACT_FAILED, 'File path is missing for PDF');
        }

        const absPath = absoluteUploadPath(source.storage_path);
        const { pageCount, pages, fullText } = await extractPdf(absPath, { planTier });

        chunks = chunkPdfPages(pages);
        metrics = {
          pageCount,
          extractedText: fullText.slice(0, 5000),
        };
      } else if (source.kind === 'youtube') {
        const urlOrId = source.source_url || source.youtube_video_id;
        if (!urlOrId) {
          throw new IngestError(INGEST_ERROR_CODES.INVALID_URL, 'YouTube URL is missing');
        }

        const { title, durationSeconds, thumbnailUrl, cues, fullText } = await ingestYouTube(
          urlOrId,
          { planTier },
        );

        chunks = chunkYouTubeTranscript(cues);
        metrics = {
          // Same aliasing trap as below: the row exposes `name`, not `title`.
          // Reading source.title made this branch always overwrite whatever
          // the student had named the source with the video's own title.
          title: source.name === 'YouTube study kit' || !source.name ? title : source.name,
          durationSeconds,
          thumbnailUrl,
          extractedText: fullText.slice(0, 5000),
        };
      } else if (source.kind === 'topic' || source.kind === 'text') {
        // `name` not `title`: sources.db aliases s.title AS name, so reading
        // source.title here always yielded undefined and every topic source
        // failed with EMPTY_CONTENT.
        const text = source.extracted_text || source.name || '';
        chunks = chunkText(text, { kind: source.kind });
        metrics = {
          extractedText: text.slice(0, 5000),
        };
      } else if (source.kind === 'image') {
        // Images without OCR are stored as a placeholder chunk
        const label = source.original_filename || source.name || 'Image material';
        chunks = chunkText(`[Image: ${label}]`, { kind: 'image' });
      }

      if (chunks.length === 0) {
        throw new IngestError(
          INGEST_ERROR_CODES.EMPTY_CONTENT,
          'No readable content could be extracted from this material.',
        );
      }

      // Step 2: Embedding stage
      await sourcesDb.updateStatus(sourceId, {
        stage: 'embedding',
        progressPercent: 60,
        ...metrics,
      });

      const textsToEmbed = chunks.map((c) => c.content);

      // Embedding a whole document is the single biggest token spend in the
      // product, and the one most sensitive to Khmer's tokenizer penalty, so
      // the language is inferred here rather than left null.
      const { embeddings } = await trackGeneration(
        {
          kind: 'embedding',
          userId: source.user_id,
          studyKitId: source.study_kit_id,
          sourceId,
          language: detectCostLanguage(textsToEmbed.join('\n')),
          sourceText: textsToEmbed.join('\n'),
          request: { chunks: textsToEmbed.length },
          describe: (value) => ({ vectors: value.embeddings?.length ?? 0, dimensions: value.dimensions }),
        },
        ({ ai, onUsage }) => ai.embed({ texts: textsToEmbed, onUsage }),
      );

      const chunksWithEmbeddings = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));

      // Step 3: Transactional persistence of chunks & status update
      await withTransaction(async (client) => {
        await chunksDb.deleteForSource(client, { sourceId });
        await chunksDb.insertBatch(client, {
          sourceId,
          studyKitId: source.study_kit_id,
          chunks: chunksWithEmbeddings,
        });
      });

      // Step 4: Mark ready
      await sourcesDb.updateStatus(sourceId, {
        status: 'ready',
        stage: 'ready',
        progressPercent: 100,
        errorMessage: null,
        metadata: {
          chunkCount: chunks.length,
          stage: 'ready',
          progressPercent: 100,
        },
      });

      console.log(
        `[ingest] source ${sourceId} (${source.kind}) successfully processed into ${chunks.length} chunks`,
      );
    } catch (err) {
      console.error(`[ingest] source ${sourceId} failed:`, err.message);
      await sourcesDb.updateStatus(sourceId, {
        status: 'failed',
        errorMessage: err.message,
        stage: 'failed',
        progressPercent: 0,
        metadata: {
          stage: 'failed',
          errorCode: err.code || 'unknown',
        },
      });
    }
  },
};

// Register handler on the job queue
jobQueue.register('source:ingest', ({ sourceId }) => ingestService.processSource(sourceId));
