/**
 * Token-aware text chunking with citation preservation.
 *
 * Requirements:
 * - ~500 tokens per chunk with ~50-75 token overlap
 * - Preserves page_number for PDFs (Citation.pageNumber)
 * - Preserves start_seconds & end_seconds for YouTube transcripts (Citation.startSeconds)
 * - Assigns contiguous chunk_index (0, 1, 2, ...)
 */

const TARGET_CHUNK_TOKENS = 500;
const OVERLAP_TOKENS = 60;

/**
 * Script-aware token estimation.
 * English / Latin averages ~4 characters per token.
 * Khmer text (\u1780-\u17FF) is dense with no word spaces, averaging ~1.5-2 chars per token.
 */
export const estimateTokens = (text) => {
  if (!text) return 0;
  const str = String(text);

  // Count Khmer/non-Latin characters
  const khmerMatches = str.match(/[\u1780-\u17FF\u19E0-\u19FF]/g);
  const khmerCount = khmerMatches ? khmerMatches.length : 0;
  const otherCount = str.length - khmerCount;

  // Khmer: ~1.6 chars per token; Other: ~4 chars per token
  const khmerTokens = Math.ceil(khmerCount / 1.6);
  const otherTokens = Math.ceil(otherCount / 4.0);

  return Math.max(1, khmerTokens + otherTokens);
};

/**
 * Split text into semantic fragments (paragraphs, sentences, clauses).
 * Respects Western punctuation (. ! ?) and Khmer punctuation (។ ៕).
 */
const splitSentences = (text) => {
  if (!text) return [];
  // Split on paragraph breaks or sentence terminators while preserving delimiters
  return text
    .split(/(?<=[.!?។៕\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * Chunks text for a single page or section while maintaining overlap.
 */
const chunkSentenceList = (sentences, initialOverlap = '') => {
  const chunks = [];
  let currentParts = initialOverlap ? [initialOverlap] : [];
  let currentTokens = initialOverlap ? estimateTokens(initialOverlap) : 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > TARGET_CHUNK_TOKENS && currentParts.length > 0) {
      const chunkText = currentParts.join(' ');
      chunks.push({
        text: chunkText,
        tokens: currentTokens,
      });

      // Calculate overlap: take the last few sentences totaling ~OVERLAP_TOKENS
      const overlapParts = [];
      let overlapCount = 0;
      for (let i = currentParts.length - 1; i >= 0; i--) {
        const p = currentParts[i];
        const pTokens = estimateTokens(p);
        if (overlapCount + pTokens <= OVERLAP_TOKENS || overlapParts.length === 0) {
          overlapParts.unshift(p);
          overlapCount += pTokens;
        } else {
          break;
        }
      }

      currentParts = [...overlapParts, sentence];
      currentTokens = overlapCount + sentenceTokens;
    } else {
      currentParts.push(sentence);
      currentTokens += sentenceTokens;
    }
  }

  if (currentParts.length > 0) {
    const chunkText = currentParts.join(' ');
    // Only add if not identical to previous chunk
    if (chunks.length === 0 || chunks[chunks.length - 1].text !== chunkText) {
      chunks.push({
        text: chunkText,
        tokens: currentTokens,
      });
    }
  }

  return chunks;
};

/**
 * Chunks PDF pages while preserving page_number.
 * @param {Array<{ pageNumber: number, text: string }>} pages
 * @returns {Array<{ chunkIndex: number, content: string, tokenCount: number, pageNumber: number, startSeconds: null, endSeconds: null, metadata: Object }>}
 */
export const chunkPdfPages = (pages = []) => {
  const result = [];
  let chunkIndex = 0;

  for (const page of pages) {
    if (!page.text || !page.text.trim()) continue;

    const sentences = splitSentences(page.text);
    if (sentences.length === 0) continue;

    const pageChunks = chunkSentenceList(sentences);

    for (const chunk of pageChunks) {
      result.push({
        chunkIndex: chunkIndex++,
        content: chunk.text,
        tokenCount: chunk.tokens,
        pageNumber: page.pageNumber,
        startSeconds: null,
        endSeconds: null,
        metadata: {
          kind: 'pdf',
          pageNumber: page.pageNumber,
        },
      });
    }
  }

  return result;
};

/**
 * Chunks the numbered parts of an Office document or text file.
 *
 * The same job chunkPdfPages does, over slides, sheets or sections instead of
 * pages — so a citation into a deck carries its slide number the way a citation
 * into a PDF carries its page. The number is written to `pageNumber` rather
 * than a new column because that column already means "the numbered part of
 * this source", and splitting it would mean teaching every reader of a chunk
 * about a second one.
 *
 * `unit` rides along in metadata so the label can say "slide 12" rather than
 * "page 12" for a file that has no pages.
 *
 * @param {Array<{ number: number, title: string|null, text: string }>} sections
 * @param {{ unit?: string, format?: string }} [options]
 */
export const chunkDocumentSections = (sections = [], { unit = 'section', format = 'document' } = {}) => {
  const result = [];
  let chunkIndex = 0;

  for (const section of sections) {
    if (!section.text || !section.text.trim()) continue;

    const sentences = splitSentences(section.text);
    if (sentences.length === 0) continue;

    for (const chunk of chunkSentenceList(sentences)) {
      result.push({
        chunkIndex: chunkIndex++,
        content: chunk.text,
        tokenCount: chunk.tokens,
        pageNumber: section.number,
        startSeconds: null,
        endSeconds: null,
        metadata: {
          kind: format,
          unit,
          pageNumber: section.number,
          ...(section.title && { sectionTitle: section.title }),
        },
      });
    }
  }

  return result;
};

/**
 * Chunks YouTube transcript cues while preserving startSeconds and endSeconds.
 * @param {Array<{ text: string, startSeconds: number, durationSeconds: number }>} cues
 * @returns {Array<{ chunkIndex: number, content: string, tokenCount: number, pageNumber: null, startSeconds: number, endSeconds: number, metadata: Object }>}
 */
export const chunkYouTubeTranscript = (cues = []) => {
  const result = [];
  if (!cues || cues.length === 0) return result;

  let chunkIndex = 0;
  let currentCues = [];
  let currentTokens = 0;

  const flushChunk = (cuesToFlush) => {
    if (cuesToFlush.length === 0) return;
    const text = cuesToFlush.map((c) => c.text).join(' ');
    const firstCue = cuesToFlush[0];
    const lastCue = cuesToFlush[cuesToFlush.length - 1];
    const startSeconds = Math.round(firstCue.startSeconds);
    const endSeconds = Math.round(lastCue.startSeconds + (lastCue.durationSeconds || 0));

    result.push({
      chunkIndex: chunkIndex++,
      content: text,
      tokenCount: estimateTokens(text),
      pageNumber: null,
      startSeconds,
      endSeconds,
      metadata: {
        kind: 'youtube',
        startSeconds,
        endSeconds,
      },
    });
  };

  for (const cue of cues) {
    const cueTokens = estimateTokens(cue.text);

    if (currentTokens + cueTokens > TARGET_CHUNK_TOKENS && currentCues.length > 0) {
      flushChunk(currentCues);

      // Select overlap cues (~OVERLAP_TOKENS)
      const overlapCues = [];
      let overlapCount = 0;
      for (let i = currentCues.length - 1; i >= 0; i--) {
        const c = currentCues[i];
        const cTokens = estimateTokens(c.text);
        if (overlapCount + cTokens <= OVERLAP_TOKENS || overlapCues.length === 0) {
          overlapCues.unshift(c);
          overlapCount += cTokens;
        } else {
          break;
        }
      }

      currentCues = [...overlapCues, cue];
      currentTokens = overlapCount + cueTokens;
    } else {
      currentCues.push(cue);
      currentTokens += cueTokens;
    }
  }

  if (currentCues.length > 0) {
    flushChunk(currentCues);
  }

  return result;
};

/**
 * Chunks generic text / topic.
 */
export const chunkText = (text, { kind = 'text', pageNumber = null } = {}) => {
  const sentences = splitSentences(text);
  const rawChunks = chunkSentenceList(sentences);

  return rawChunks.map((chunk, index) => ({
    chunkIndex: index,
    content: chunk.text,
    tokenCount: chunk.tokens,
    pageNumber,
    startSeconds: null,
    endSeconds: null,
    metadata: { kind },
  }));
};
