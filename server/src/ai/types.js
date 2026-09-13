/**
 * The AI layer contract.
 *
 * Every provider in this directory implements `AIProvider` exactly. Callers get
 * one through `getAI()` in ./index.js and never import a provider directly
 * (CLAUDE.md, AI layer), so swapping mock for real changes nothing upstream.
 *
 * Naming: these shapes are camelCase because they are plain JS objects. The
 * database columns they land in are snake_case — services do that mapping when
 * they write rows, so nothing here has to know about SQL.
 *
 * This file is types only. It exports runtime constants but no behaviour.
 */

/** @typedef {'km' | 'en'} Language */

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

/**
 * One generated summary. Maps to a `summaries` row.
 *
 * @typedef  {Object}   Summary
 * @property {string}   title      Short heading, in the requested language.
 * @property {string}   bodyMd     Markdown body. Headings no deeper than `##`.
 * @property {string[]} keyPoints  3-5 one-line takeaways.
 */

/**
 * Where a chapter sits in the source. Produced once, then reused on every
 * resumed generation so chapter boundaries never shift between runs.
 *
 * @typedef  {Object} ChapterOutlineEntry
 * @property {number} chapterIndex   1-based, contiguous, in playback order.
 * @property {string} title
 * @property {number} startSeconds
 * @property {number} endSeconds     Always > startSeconds.
 */

/**
 * A chapter with its body written. Maps to a `summaries` row with
 * `scope = 'chapter'` and `status = 'ready'`.
 *
 * @typedef  {ChapterOutlineEntry & { bodyMd: string, keyPoints: string[] }} SummaryChapter
 */

/**
 * @typedef  {Object}                ChapteredSummary
 * @property {string}                title
 * @property {string}                bodyMd    Overview of the whole source.
 * @property {ChapterOutlineEntry[]} outline   ALWAYS every chapter, so the
 *                                             caller can create one `summaries`
 *                                             row per chapter up front.
 * @property {SummaryChapter[]}      chapters  Bodies for the requested indices
 *                                             only — see `only` below.
 */

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

/** @typedef {'multiple_choice' | 'true_false' | 'short_answer' | 'written'} QuestionKind */

/**
 * One question. Maps to a `quiz_questions` row, where `options` and
 * `correctAnswer` are stored as JSONB.
 *
 * @typedef  {Object}        QuizQuestion
 * @property {QuestionKind}  kind
 * @property {string}        prompt
 * @property {string[]}      options        4 for multiple_choice, 2 for
 *                                          true_false, empty otherwise.
 * @property {number|string} correctAnswer  0-based index into `options` for
 *                                          choice questions; the expected text
 *                                          for short_answer and written.
 * @property {string}        explanation    Shown after answering — see
 *                                          docs/screens/06-quiz/02.
 * @property {string}        topic          Topic label; feeds `topics` and
 *                                          weak-topic detection.
 */

/**
 * @typedef  {Object}         Quiz
 * @property {string}         title
 * @property {QuizQuestion[]} questions
 */

/**
 * The "Your takeaways" card and mastery ring on
 * docs/screens/06-quiz/03-quiz-completed-results. Maps to columns on
 * `quiz_attempts`.
 *
 * @typedef  {Object}   AttemptSummary
 * @property {string[]} takeaways       Up to 5, addressed to the student.
 * @property {number}   masteryPercent  0-100.
 * @property {string[]} weakTopics      Topics worth reviewing; may be empty.
 */

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

/**
 * One card. Maps to a `flashcards` row; the SM-2 scheduling columns are set by
 * the service, never by the model.
 *
 * @typedef  {Object}      Flashcard
 * @property {string}      term
 * @property {string}      definition  One or two sentences, recallable.
 * @property {string|null} hint        null unless a short nudge genuinely helps.
 * @property {string}      topic
 */

// ---------------------------------------------------------------------------
// Tutor chat
// ---------------------------------------------------------------------------

/**
 * A retrieved chunk handed to the tutor as grounding. Built by the service from
 * `document_chunks`; providers only read it.
 *
 * @typedef  {Object}      TutorSource
 * @property {string}      title           e.g. "Database Week 1.pdf".
 * @property {string}      content         The chunk text.
 * @property {number|null} [pageNumber]    For PDFs.
 * @property {number|null} [startSeconds]  For transcripts.
 */

/**
 * The "Source: Database Week 1.pdf" chip on docs/screens/05-ai-tutor-chat/01.
 * Stored in `chat_messages.citations` (JSONB).
 *
 * @typedef  {Object}      Citation
 * @property {string}      sourceTitle
 * @property {number|null} pageNumber
 * @property {number|null} startSeconds
 */

/** @typedef {{ role: 'user' | 'assistant', content: string }} TutorMessage */

/**
 * `tutorReply` is an async generator so the SSE route can forward deltas as
 * they arrive. It yields zero or more `delta` chunks, then EXACTLY ONE terminal
 * chunk — `done` on success, `error` on failure. The terminal chunk always
 * arrives, so the route has an unambiguous close signal.
 *
 * @typedef {{ type: 'delta', text: string }} TutorDelta
 * @typedef {{ type: 'done', citations: Citation[], suggestedFollowups: string[] }} TutorDone
 * @typedef {{ type: 'error', message: string }} TutorError
 * @typedef {TutorDelta | TutorDone | TutorError} TutorChunk
 */

// ---------------------------------------------------------------------------
// Method inputs
// ---------------------------------------------------------------------------

/**
 * @typedef  {Object}   SummarizeInput
 * @property {string}   text             Source text. Providers must NOT
 *                                       truncate it — they throw, and the
 *                                       caller chunks.
 * @property {string}   [title]
 * @property {Language} [language='km']
 */

/**
 * Resumable by design. A 12-chapter lecture is generated as 12 independent
 * units so a failure at chapter 9 never rewrites chapters 1-8.
 *
 * Intended flow, paired with `summaries.status`:
 *   1. `summarizeChapters({ text, chapterCount: 12, only: [] })`
 *      -> full `outline`, no bodies. Insert 12 rows at status 'pending'.
 *   2. For each pending index: `summarizeChapters({ text, outline, only: [n] })`
 *      -> flip that row 'generating' -> 'ready' with the returned body.
 *   3. After a crash, re-query `WHERE status <> 'ready'` and pass those indices
 *      as `only`. Completed chapters are never regenerated.
 *
 * Passing `outline` back is what makes step 3 safe: boundaries are fixed by the
 * first call, so a resumed run cannot shift them.
 *
 * @typedef  {Object}                SummarizeChaptersInput
 * @property {string}                text
 * @property {string}                [title]
 * @property {Language}              [language='km']
 * @property {number}                [durationSeconds]  Source length, for timings.
 * @property {number}                [chapterCount=12]  Ignored when `outline` is given.
 * @property {ChapterOutlineEntry[]} [outline]          Reuse a known outline instead
 *                                                      of deriving a new one.
 * @property {number[]}              [only]             Chapter indices to write
 *                                                      bodies for. `[]` means
 *                                                      outline only; omitted
 *                                                      means all of them.
 */

/**
 * @typedef  {Object}   QuizInput
 * @property {string}   text
 * @property {string}   [title]
 * @property {Language} [language='km']
 * @property {number}   [count=10]
 * @property {'easy'|'medium'|'hard'|'mixed'} [difficulty='mixed']
 */

/**
 * @typedef  {Object}   FlashcardInput
 * @property {string}   text
 * @property {Language} [language='km']
 * @property {number}   [count=12]
 */

/**
 * @typedef  {Object}   AttemptInput
 * @property {number}   correctCount
 * @property {number}   totalQuestions
 * @property {string[]} [missedTopics]   Topics the student got wrong.
 * @property {string}   [quizTitle]
 * @property {Language} [language='km']
 */

/**
 * @typedef  {Object}        TutorInput
 * @property {TutorMessage[]} messages       Full turn history, oldest first.
 * @property {TutorSource[]}  [sources]      Retrieved grounding chunks.
 * @property {Language}       [language='km']
 */

/**
 * @typedef  {Object}   EmbedInput
 * @property {string[]} texts  One vector back per entry, in the same order.
 */

/**
 * @typedef  {Object}     EmbedResult
 * @property {number[][]} embeddings  Each EMBEDDING_DIMENSIONS long and
 *                                    unit-normalised, so cosine distance in
 *                                    pgvector behaves.
 * @property {number}     dimensions  Always EMBEDDING_DIMENSIONS.
 */

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * @typedef  {Object} AIProvider
 * @property {string} name  'mock' | 'openai'. Logged, and gates cost controls.
 *
 * @property {(input: SummarizeInput) => Promise<Summary>} summarize
 *
 * @property {(input: SummarizeChaptersInput) => Promise<ChapteredSummary>} summarizeChapters
 *   Resumable — always returns the full outline, bodies only for `only`.
 *
 * @property {(input: QuizInput) => Promise<Quiz>} generateQuiz
 *
 * @property {(input: FlashcardInput) => Promise<Flashcard[]>} generateFlashcards
 *
 * @property {(input: TutorInput) => AsyncGenerator<TutorChunk>} tutorReply
 *   Streaming. Yields deltas, then exactly one terminal `done` or `error`.
 *
 * @property {(input: AttemptInput) => Promise<AttemptSummary>} summarizeAttempt
 *
 * @property {(input: EmbedInput) => Promise<EmbedResult>} embed
 *   Batched. Must preserve input order.
 */

/**
 * Embedding width. Pinned to `document_chunks.embedding vector(1536)` in
 * 001_init.sql and to text-embedding-3-small's native size. Changing it means a
 * migration plus a full re-embed, so both providers hard-fail on a mismatch
 * rather than writing a wrong-width vector.
 */
export const EMBEDDING_DIMENSIONS = 1536;

/** Valid values for `AIProvider.name`. */
export const PROVIDER_NAMES = /** @type {const} */ (['mock', 'openai']);

/** Languages every provider must produce. */
export const LANGUAGES = /** @type {const} */ (['km', 'en']);

/** Every method on AIProvider — used by the conformance check in ./index.js. */
export const AI_METHODS = /** @type {const} */ ([
  'summarize',
  'summarizeChapters',
  'generateQuiz',
  'generateFlashcards',
  'tutorReply',
  'summarizeAttempt',
  'embed',
]);

/**
 * Throws unless `vector` is exactly EMBEDDING_DIMENSIONS long. Shared by both
 * providers so a mismatch fails at the source rather than at the INSERT.
 *
 * @param {number[]} vector
 * @param {string} [context]
 */
export const assertEmbeddingWidth = (vector, context = 'embedding') => {
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${context}: expected ${EMBEDDING_DIMENSIONS} dimensions to match ` +
        `document_chunks.embedding, got ${Array.isArray(vector) ? vector.length : typeof vector}`,
    );
  }
  return vector;
};
