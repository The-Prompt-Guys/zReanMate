import { readFile } from 'node:fs/promises';

import { chunksDb } from '../db/chunks.db.js';
import { withTransaction } from '../db/pool.js';
import { sourcesDb } from '../db/sources.db.js';
import { usersDb } from '../db/users.db.js';
import {
  chunkDocumentSections,
  chunkPdfPages,
  chunkText,
  chunkYouTubeTranscript,
} from '../ingest/chunker.js';
import { INGEST_ERROR_CODES, IngestError } from '../ingest/errors.js';
import { extractDocument } from '../ingest/office.js';
import { extractPdf } from '../ingest/pdf.js';
import { ingestYouTube } from '../ingest/youtube.js';
import { jobQueue } from '../jobs/queue.js';
import { absoluteUploadPath } from '../middleware/upload.js';
import { detectCostLanguage, trackGeneration } from './aiUsage.service.js';
import { flashcardsService } from './flashcards.service.js';
import { quizService } from './quiz.service.js';
import { summariesService } from './summaries.service.js';
import { studyGuideService } from './studyGuide.service.js';

/**
 * Ingest pipeline service:
 * 1. Text extraction with citation preservation (PDF page, document slide or
 *    sheet, YouTube timestamp), including a vision OCR pass for photographed
 *    material and an OOXML reader for Word, Excel and PowerPoint
 * 2. Pre-token plan limits enforcement (50 pages, slides or sheets per
 *    document; 30-min YouTube, for the Free plan)
 * 3. Token-aware chunking (~500 tokens with overlap)
 * 4. Batched embeddings via the AI layer, recorded in ai_generations
 * 5. Vector persistence in document_chunks
 * 6. The study materials a student can open straight afterwards
 */

/**
 * The generations a source is not "ready" without.
 *
 * These used to be produced lazily, the first time someone opened the screen
 * that needed them — so a student watched the upload finish, tapped Study
 * Guide, and waited on the model all over again. Running them here moves that
 * wait into the progress bar they are already watching, and every one of these
 * screens becomes a cache read afterwards.
 *
 * Quiz also fills the question pool that practice and mock exams draw from, so
 * those stop cold-starting too.
 *
 * `percent` is reported before the step runs, so the bar moves with the work
 * rather than after it.
 */
const STUDY_MATERIALS = [
  { percent: 65, run: ({ sourceId, language }) => summariesService.prewarm(sourceId, { language }) },
  // The Study Guide is the slowest of these — an outline plus one call per
  // module — which is exactly why it is prewarmed rather than left to the
  // screen. It is also the first thing most students open.
  {
    percent: 70,
    run: ({ sourceId, language }) => studyGuideService.prewarm(sourceId, { language }),
  },
  {
    percent: 80,
    run: ({ sourceId, userId, language }) => quizService.prewarm(userId, sourceId, { language }),
  },
  {
    percent: 90,
    run: ({ sourceId, userId, language }) => flashcardsService.prewarm(userId, sourceId, { language }),
  },
];

/**
 * A generation that fails is logged and stepped over rather than failing the
 * source. The text ingested fine and is still readable, and the screen that
 * wants the missing piece will generate it on demand exactly as it used to —
 * one slow screen beats losing a material that was otherwise good.
 */
const generateStudyMaterials = async (context) => {
  for (const step of STUDY_MATERIALS) {
    await sourcesDb.updateStatus(context.sourceId, {
      stage: 'generating',
      progressPercent: step.percent,
    });

    try {
      await step.run(context);
    } catch (err) {
      console.error(
        `[ingest] source ${context.sourceId}: study material at ${step.percent}% failed:`,
        err.message,
      );
    }
  }
};

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
      } else if (source.kind === 'document') {
        if (!source.storage_path) {
          throw new IngestError(
            INGEST_ERROR_CODES.EXTRACT_FAILED,
            'File path is missing for document',
          );
        }

        const { format, unit, sectionCount, sections, fullText } = await extractDocument(
          absoluteUploadPath(source.storage_path),
          { mimeType: source.mime_type, planTier },
        );

        chunks = chunkDocumentSections(sections, { unit, format });
        metrics = {
          // Recorded under pageCount because that is the column the schema
          // already has for "how many numbered parts" — a slide count and a
          // page count answer the same question. `unit` says which word to use.
          pageCount: sectionCount,
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
        if (!source.storage_path) {
          throw new IngestError(
            INGEST_ERROR_CODES.EXTRACT_FAILED,
            'File path is missing for image',
          );
        }

        const label = source.original_filename || source.name || 'Image material';
        let bytes;
        try {
          bytes = await readFile(absoluteUploadPath(source.storage_path));
        } catch (err) {
          throw new IngestError(
            INGEST_ERROR_CODES.EXTRACT_FAILED,
            `Could not read the uploaded image: ${err.message}`,
          );
        }

        // An empty file never reaches the model: it is a broken upload rather
        // than an unreadable photo, and the advice for the two is different.
        if (bytes.length === 0) {
          throw new IngestError(
            INGEST_ERROR_CODES.EXTRACT_FAILED,
            'This image file is empty. Please upload it again.',
          );
        }

        const extracted = await trackGeneration(
          {
            kind: 'ocr',
            userId: source.user_id,
            studyKitId: source.study_kit_id,
            sourceId,
            // The language of a photo is not knowable before it is read, so
            // unlike every other kind this one is labelled from the OUTPUT.
            // Guessing from the filename would put Khmer pages in the English
            // bucket and quietly bias the very ratio this row exists to measure.
            language: null,
            sourceText: null,
            request: { mimeType: source.mime_type ?? null, bytes: bytes.length },
            describe: (value) => ({ hasText: value.hasText, chars: value.text.length }),
          },
          ({ ai, onUsage }) =>
            ai.extractImageText({
              images: [
                { data: bytes, mimeType: source.mime_type || 'image/jpeg', name: label },
              ],
              onUsage,
            }),
        );

        if (!extracted.hasText) {
          // A photo with nothing to read is a dead end: chunking the
          // description alone would build a quiz out of "a photo of a cat".
          // Fail with what the model saw, so the student can tell a wrong file
          // apart from a blurred one.
          // The description is a sentence of its own, so it is lowercased into
          // the middle of this one rather than spliced in capitalised.
          const looksLike = extracted.description
            ? `${extracted.description[0].toLowerCase()}${extracted.description.slice(1)}`
            : '';

          throw new IngestError(
            INGEST_ERROR_CODES.EMPTY_CONTENT,
            [
              'No readable text was found in this photo.',
              looksLike && `It looks like ${looksLike.replace(/\.$/, '')}.`,
              'Try a straight-on, well-lit shot of the page.',
            ]
              .filter(Boolean)
              .join(' '),
          );
        }

        // The description rides along as a first line rather than being
        // dropped: on a page that is mostly a diagram it is the only account of
        // what the diagram shows, and the tutor has nothing else to cite.
        const text = extracted.description
          ? `${extracted.description}\n\n${extracted.text}`
          : extracted.text;

        chunks = chunkText(text, { kind: 'image' });
        metrics = {
          extractedText: text.slice(0, 5000),
        };
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

      // Step 4: Build the study materials before calling this ready. The
      // language comes from the content itself rather than a user setting —
      // the summary of a Khmer page should be Khmer whoever uploaded it.
      await generateStudyMaterials({
        sourceId,
        userId: source.user_id,
        language: detectCostLanguage(textsToEmbed.join('\n')),
      });

      // Step 5: Mark ready
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
