import OpenAI from 'openai';

import { env } from '../config/env.js';
import { EMBEDDING_DIMENSIONS, assertEmbeddingWidth } from './types.js';

/**
 * Real OpenAI provider. Wired but unreachable until OPENAI_API_KEY is set —
 * getAI() in ./index.js picks the mock when the key is absent.
 *
 * Structured methods use strict json_schema response formats, which guarantee
 * the model returns exactly the declared shape. Strict mode supports only a
 * subset of JSON Schema: every object needs `additionalProperties: false`, every
 * property must be listed in `required`, and validation keywords (minLength,
 * minItems, pattern, …) are rejected. So the schemas below are deliberately
 * plain, and anything tighter is enforced in JS after parsing.
 */

const MAX_SOURCE_CHARS = 120_000;
const EMBED_BATCH_SIZE = 96;
const RETRY_ATTEMPTS = 4;
const RETRY_BASE_MS = 500;

const LANGUAGE_NAMES = { km: 'Khmer (ភាសាខ្មែរ)', en: 'English' };

/**
 * What a caller's output budget has to be multiplied by to hold the same
 * answer in each language. Khmer measures at ~2.9x English on this tokenizer
 * (`npm run measure:khmer-ratio`), so a flat cap sized for English truncates
 * Khmer replies mid-sentence — backwards for a product whose default language
 * is Khmer.
 */
const LANGUAGE_TOKEN_COST = { km: 3, en: 1 };

/**
 * Reasoning models spend max_completion_tokens on reasoning before writing a
 * word, so the visible reply competes with the thinking for one budget. Ample
 * headroom, because a cap is not a charge: only tokens actually generated are
 * billed, so raising it costs nothing on the replies that never reach it.
 */
const REASONING_HEADROOM_TOKENS = 256;

/**
 * Turns a caller's "how long should the reply be" into a wire cap.
 * `maxOutputTokens` stays what it has always meant: the visible answer, sized
 * in English.
 */
const outputBudget = (maxOutputTokens, language) =>
  Math.ceil(maxOutputTokens * (LANGUAGE_TOKEN_COST[language] ?? LANGUAGE_TOKEN_COST.km)) +
  REASONING_HEADROOM_TOKENS;

/**
 * Request parameters that are optimisations rather than requirements, and that
 * plenty of models and endpoints reject outright with a 400.
 *
 * gpt-4o-mini refuses both service_tier and reasoning_effort; an
 * OpenAI-compatible gateway may refuse any of the three. None of them is worth
 * failing a generation over — a student's summary should not disappear because
 * the model has no opinion about pricing tiers — so a refused parameter is
 * dropped and the call retried without it.
 *
 * Losing stream_options costs token accounting on tutor turns, not the reply
 * itself, which is the right thing to sacrifice of the two.
 */
const OPTIONAL_PARAMS = ['service_tier', 'reasoning_effort', 'stream_options'];

/** True when a 400 names this particular parameter as the problem. */
const rejectsParam = (err, param) => {
  const status = err?.status ?? err?.response?.status;
  if (status !== 400) return false;
  const message = `${err?.error?.message ?? ''} ${err?.message ?? ''}`.toLowerCase();
  return message.includes(param);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * OpenAI's usage block -> the provider-neutral TokenUsage in ./types.js.
 *
 * Reasoning and cached counts arrive in sub-objects only some models send, so
 * both default to 0 rather than null: a model that does not reason has
 * genuinely spent zero reasoning tokens, and these get summed downstream.
 */
const normalizeUsage = (usage, model) => {
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
    cachedPromptTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
    apiCalls: 1,
    model,
  };
};

/**
 * Best-effort by contract (types.js, UsageReporter): telemetry must never break
 * a generation that already succeeded, so a throwing reporter is logged and
 * swallowed rather than surfaced to the student.
 */
const reportUsage = (onUsage, usage, model) => {
  if (typeof onUsage !== 'function') return;
  const normalized = normalizeUsage(usage, model);
  if (!normalized) return;
  try {
    onUsage(normalized);
  } catch (err) {
    console.warn(`[ai] usage reporter threw, ignoring: ${err.message}`);
  }
};

const systemPrompt = (language) =>
  [
    'You are ReanMate, a study tutor for Cambodian secondary and university students.',
    `Write every user-facing string in ${LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES.km}.`,
    language === 'km'
      ? 'For Khmer replies, write the explanation in Khmer script and translate ordinary English wording into Khmer. Keep English only for code, filenames, proper names, or an unavoidable technical label, and put the Khmer explanation first.'
      : '',
    'Explain plainly, use short sentences, and prefer a concrete example over an abstract rule.',
    'Base every claim on the study material provided. If the material does not answer the',
    'question, say so rather than inventing an answer.',
  ].filter(Boolean).join(' ');

/**
 * Never silently truncate — a summary of half a document looks correct and is
 * wrong. Throw so the caller chunks instead.
 */
const requireFittingText = (text) => {
  const value = text ?? '';
  if (value.length > MAX_SOURCE_CHARS) {
    throw new Error(
      `Study material is ${value.length} characters, over the ${MAX_SOURCE_CHARS} limit for a ` +
        'single request. Chunk it before calling the AI layer.',
    );
  }
  return value || 'No study material was provided.';
};

const isRetryable = (err) => {
  const status = err?.status ?? err?.response?.status;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500 && status < 600) return true;
  return err instanceof OpenAI.APIConnectionError || err?.code === 'ECONNRESET';
};

/** Exponential backoff with jitter, honouring Retry-After when the API sends it. */
const withRetry = async (label, fn) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt >= RETRY_ATTEMPTS - 1) throw err;

      const retryAfter = Number(err?.headers?.['retry-after']);
      const delay = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : RETRY_BASE_MS * 2 ** attempt + Math.random() * 250;

      console.warn(
        `[ai] ${label} failed (${err?.status ?? err?.code ?? 'network'}), ` +
          `retry ${attempt + 1}/${RETRY_ATTEMPTS - 1} in ${Math.round(delay)}ms`,
      );
      await sleep(delay);
    }
  }
};

// ---------------------------------------------------------------------------
// Strict JSON schemas — the wire contract with the model.
// ---------------------------------------------------------------------------

const obj = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const stringArray = (description) => ({ type: 'array', items: { type: 'string' }, description });

const SUMMARY_SCHEMA = obj({
  title: { type: 'string', description: 'Short heading for the summary.' },
  bodyMd: { type: 'string', description: 'Markdown body, headings no deeper than ##.' },
  keyPoints: stringArray('Three to five one-line takeaways.'),
});

/**
 * The study guide, in two schemas because it is generated in two passes.
 *
 * Both are strict: the four sections are required on every module, so a model
 * that runs out of things to say about pitfalls has to write the section anyway
 * rather than dropping it and leaving the screen with a hole in it.
 */
const STUDY_GUIDE_OUTLINE_SCHEMA = obj({
  modules: {
    type: 'array',
    description:
      'Every concept the document teaches, in the order it introduces them. ' +
      'One entry per concept - not per page, and not per heading.',
    items: obj({
      moduleIndex: { type: 'integer', description: '1-based, contiguous, in document order.' },
      title: {
        type: 'string',
        description:
          'The concept itself, e.g. "Normalization to 3NF" - never "Module 3" or "Introduction".',
      },
      focus: {
        type: 'string',
        description:
          'One line naming exactly what this module must teach, so modules do not overlap.',
      },
    }),
  },
});

const STUDY_GUIDE_MODULE_SCHEMA = obj({
  title: { type: 'string', description: 'The concept being taught.' },
  explanationMd: {
    type: 'string',
    description:
      'EXACTLY 3 to 5 markdown bullets, one line each, with **key terms** bolded. Say how and ' +
      'why the concept works, not just what it is. Scannable, not prose - no paragraphs, no ' +
      'heading, and no bullet longer than two lines.',
  },
  applicationMd: {
    type: 'string',
    description:
      'ONE brief example taken from this document: a worked case, a formula, a fenced code ' +
      'block, or a short numbered workflow. A few lines at most. No heading, no second example.',
  },
  pitfallsMd: {
    type: 'string',
    description:
      'EXACTLY 3 markdown bullets: two common mistakes students make on THIS concept, then one ' +
      'bullet starting "**Exam tip:**" with the single thing worth remembering. No heading.',
  },
  recall: {
    type: 'array',
    description:
      'One or two questions testing this module. Every question MUST carry its written answer - ' +
      'a question with an empty or placeholder answer is invalid.',
    items: obj({
      question: { type: 'string', description: 'A conceptual question, not a definition lookup.' },
      answer: {
        type: 'string',
        description:
          'The complete answer, written out in 1 to 2 sentences. Never a letter, a cross-reference ' +
          'or "see above" - the student reads only this.',
      },
    }),
  },
});

/**
 * Note `hasText` is asked for explicitly rather than inferred from an empty
 * `text`. The model can tell a photo of a cat from notes too blurred to read;
 * a length check downstream cannot, and those two need different advice.
 */
const IMAGE_TEXT_SCHEMA = obj({
  text: {
    type: 'string',
    description:
      'Every word visible in the images, in reading order, pages separated by a blank line. ' +
      'Empty string if there is no legible text.',
  },
  hasText: {
    type: 'boolean',
    description: 'True only if at least some legible text was transcribed.',
  },
  description: {
    type: 'string',
    description: 'One sentence on what the images show, including any diagram or chart.',
  },
});

const CHAPTER_OUTLINE_SCHEMA = obj({
  chapters: {
    type: 'array',
    description: 'Sequential, non-overlapping chapters covering the whole source from 0.',
    items: obj({
      chapterIndex: { type: 'integer', description: '1-based, contiguous, in order.' },
      title: { type: 'string' },
      startSeconds: { type: 'integer' },
      endSeconds: { type: 'integer' },
    }),
  },
});

const CHAPTER_BODY_SCHEMA = obj({
  bodyMd: { type: 'string' },
  keyPoints: stringArray('Up to three takeaways for this chapter alone.'),
});

const QUIZ_SCHEMA = obj({
  title: { type: 'string' },
  questions: {
    type: 'array',
    items: obj({
      kind: {
        type: 'string',
        enum: ['multiple_choice', 'true_false', 'short_answer', 'written'],
      },
      prompt: { type: 'string' },
      options: stringArray('4 for multiple_choice, 2 for true_false, empty otherwise.'),
      // Split rather than a union: strict mode handles nullable scalars cleanly,
      // and this avoids anyOf. Recombined into `correctAnswer` below.
      correctIndex: {
        type: ['integer', 'null'],
        description: '0-based index into options for choice questions, else null.',
      },
      correctText: {
        type: ['string', 'null'],
        description: 'Expected answer for short_answer/written, else null.',
      },
      explanation: {
        type: 'string',
        description:
          'Why the correct option is right AND why each distractor is wrong, both grounded in ' +
          'the document. A student who picked wrongly must learn what they misread.',
      },
      topic: { type: 'string' },
      targetedWeakConcept: {
        type: ['string', 'null'],
        description:
          'The weak concept this question was written to attack, copied EXACTLY from the list ' +
          'of weak concepts in the instructions. null when the question covers the rest of the ' +
          'document instead.',
      },
    }),
  },
});

const MOCK_EXAM_SCHEMA = obj({
  title: { type: 'string' },
  questions: {
    type: 'array',
    items: obj({
      kind: {
        type: 'string',
        enum: ['multiple_choice', 'true_false', 'short_answer', 'written'],
      },
      prompt: { type: 'string' },
      options: stringArray('4 for multiple_choice, 2 for true_false, empty otherwise.'),
      correctIndex: {
        type: ['integer', 'null'],
        description: '0-based index into options for choice questions, else null.',
      },
      correctText: {
        type: ['string', 'null'],
        description: 'Expected answer for short_answer/written, else null.',
      },
      // The field that lets one bank serve both answer formats. Asked for on
      // EVERY question, including multiple choice, because the student may sit
      // the same bank with the options hidden.
      expectedAnswer: {
        type: 'string',
        description:
          'The correct answer written out in full, one or two sentences, as a student would ' +
          'write it from memory. NEVER a letter, an option number, or a cross-reference: this ' +
          'is what a typed answer is marked against, and "B" marks nothing.',
      },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      explanation: {
        type: 'string',
        description:
          'Why the correct answer is right AND why each distractor is wrong, grounded in the ' +
          'document.',
      },
      topic: { type: 'string' },
    }),
  },
});

const WRITTEN_GRADES_SCHEMA = obj({
  grades: {
    type: 'array',
    description: 'One entry per submitted answer, in the SAME ORDER they were given.',
    items: obj({
      isCorrect: {
        type: 'boolean',
        description:
          'True when the response conveys the expected answer. Judge MEANING: different ' +
          'wording, word order, spelling and a mix of Khmer and English are all fine.',
      },
      note: {
        type: 'string',
        description:
          'One short line addressed to the student saying what was right, or what was ' +
          'missing. In the requested language.',
      },
    }),
  },
});

const FLASHCARDS_SCHEMA = obj({
  // The interface returns a bare Flashcard[], but strict json_schema requires an
  // object at the root — so the model returns {cards} and we unwrap it here.
  cards: {
    type: 'array',
    items: obj({
      term: { type: 'string' },
      definition: { type: 'string', description: 'One or two recallable sentences.' },
      hint: { type: ['string', 'null'] },
      topic: { type: 'string' },
    }),
  },
});

const ATTEMPT_SCHEMA = obj({
  takeaways: stringArray('Up to five short takeaways addressed to the student.'),
});

const TUTOR_CITATION_HINT =
  'Answer using only the study material. Name the source you relied on in your answer.';

export const createOpenAIProvider = ({
  apiKey = env.openaiApiKey,
  model = env.openaiModel,
  embeddingModel = env.openaiEmbeddingModel,
  baseURL = env.openaiBaseUrl,
} = {}) => {
  if (!apiKey) throw new Error('createOpenAIProvider requires OPENAI_API_KEY');

  // maxRetries: 0 — withRetry owns backoff, so the SDK must not retry too.
  // baseURL is omitted rather than passed as null so the SDK keeps its own
  // default; an OpenAI-compatible endpoint overrides it.
  const client = new OpenAI({ apiKey, maxRetries: 0, ...(baseURL && { baseURL }) });

  // Optional parameters this endpoint has already refused. Scoped to the
  // provider instance, so the cost of discovering an incompatibility is one
  // wasted request per parameter for the life of the process — not one per
  // call, and not a config flag someone has to remember to flip when the
  // model changes.
  const unsupported = new Set();

  /**
   * Sends a chat completion, retrying without any optional parameter the
   * endpoint rejects. `build` receives the set of already-known-unsupported
   * parameters so it can leave them out of the request up front.
   */
  const chatCompletion = async (label, build) => {
    for (;;) {
      const params = build(unsupported);
      try {
        return await withRetry(label, () => client.chat.completions.create(params));
      } catch (err) {
        const rejected = OPTIONAL_PARAMS.find((param) => param in params && rejectsParam(err, param));
        if (!rejected) throw err;

        unsupported.add(rejected);
        console.warn(
          `[ai] ${label}: endpoint rejected ${rejected} — dropping it for this process and retrying`,
        );
      }
    }
  };

  /** One strict structured-output call, returning the parsed object. */
  const structured = async ({ label, schemaName, schema, language, prompt, material, serviceTier = 'default', reasoningEffort, onUsage }) => {
    const completion = await chatCompletion(label, (skip) => ({
      model,
      // OpenAI calls the batch-priced asynchronous tier "flex" on live
      // generation requests. The provider-neutral contract calls it batch.
      ...(serviceTier === 'batch' && !skip.has('service_tier') && { service_tier: 'flex' }),
      // 'none' is the contract's way of saying "do not reason" (types.js,
      // FlashcardInput), so it must omit the parameter rather than send it as a
      // value. It is a truthy string, so a plain truthiness check sent
      // reasoning_effort: 'none' on every flashcard call.
      ...(reasoningEffort &&
        reasoningEffort !== 'none' &&
        !skip.has('reasoning_effort') && { reasoning_effort: reasoningEffort }),
      messages: [
        { role: 'system', content: systemPrompt(language) },
        {
          role: 'user',
          content: `${prompt}\n\n--- STUDY MATERIAL ---\n${requireFittingText(material)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, strict: true, schema },
      },
    }));

    // Reported before the response is validated: those tokens were spent and
    // billed even when the JSON comes back truncated or refused.
    reportUsage(onUsage, completion.usage, model);

    const choice = completion.choices[0];
    if (choice?.finish_reason === 'length') {
      throw new Error(`${label}: model hit the output limit before completing the JSON`);
    }
    if (choice?.message?.refusal) {
      throw new Error(`${label}: model refused — ${choice.message.refusal}`);
    }

    const raw = choice?.message?.content;
    if (!raw) throw new Error(`${label}: model returned no content`);

    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`${label}: model returned unparseable JSON (${err.message})`);
    }
  };

  return {
    name: 'openai',

    async summarize({ text, title, language = 'km', serviceTier = 'default', onUsage } = {}) {
      return structured({
        label: 'summarize',
        schemaName: 'summary',
        schema: SUMMARY_SCHEMA,
        language,
        material: text,
        serviceTier,
        onUsage,
        prompt: [
          `Summarise this study material${title ? ` titled "${title}"` : ''} for a student`,
          'seeing it for the first time. Use at most two headings and give 3-5 key points.',
        ].join(' '),
      });
    },

    /**
     * Resumable in two phases: outline once, then one call per chapter body.
     * Bodies are generated concurrently but each is independent, so a failure on
     * chapter 9 leaves 1-8 intact and the caller retries only what is missing.
     */
    async summarizeChapters({
      text,
      title,
      language = 'km',
      durationSeconds,
      chapterCount = 12,
      outline = null,
      only = undefined,
      serviceTier = 'default',
      onUsage,
    } = {}) {
      const material = requireFittingText(text);

      const fullOutline =
        outline ??
        (
          await structured({
            label: 'summarizeChapters:outline',
            schemaName: 'chapter_outline',
            schema: CHAPTER_OUTLINE_SCHEMA,
            language,
            material,
            serviceTier,
            onUsage,
            prompt: [
              `Split this study material${title ? ` titled "${title}"` : ''} into about`,
              `${chapterCount} sequential chapters.`,
              durationSeconds
                ? `The source runs ${durationSeconds} seconds; chapters must tile it from 0 with no gaps or overlap.`
                : 'Use character offsets scaled to seconds if the source has no timeline.',
              'Return titles and boundaries only — no bodies.',
            ].join(' '),
          })
        ).chapters;

      const wanted =
        only === undefined
          ? fullOutline.map((c) => c.chapterIndex)
          : [...new Set(only)].filter((i) => fullOutline.some((c) => c.chapterIndex === i));

      const overview =
        wanted.length === fullOutline.length || only === undefined
          ? await this.summarize({ text: material, title, language, serviceTier, onUsage })
          : null;

      const chapters = await Promise.all(
        fullOutline
          .filter((c) => wanted.includes(c.chapterIndex))
          .map(async (c) => {
            const body = await structured({
              label: `summarizeChapters:body[${c.chapterIndex}]`,
              schemaName: 'chapter_body',
              schema: CHAPTER_BODY_SCHEMA,
              language,
              material,
              serviceTier,
              onUsage,
              prompt: [
                `Write the summary for chapter ${c.chapterIndex}, "${c.title}",`,
                `covering ${c.startSeconds}s to ${c.endSeconds}s of the material.`,
                'Cover only that span — other chapters are summarised separately.',
              ].join(' '),
            });
            return { ...c, bodyMd: body.bodyMd, keyPoints: body.keyPoints };
          }),
      );

      return {
        title: overview?.title ?? title ?? '',
        bodyMd: overview?.bodyMd ?? '',
        outline: fullOutline,
        chapters,
      };
    },

    /**
     * The Study Guide: one document turned into teaching modules.
     *
     * Three things this prompt does deliberately:
     *
     * 1. No overview. `summarize` already exists and is passive; asking for a
     *    high-level pass here would produce the "AI summary" the guide is meant
     *    to replace, and students skim those instead of working through them.
     * 2. No headings in the content. The four sections are separate fields and
     *    the screen labels them from the i18n dictionaries - so a Khmer guide is
     *    Khmer throughout, and the model cannot quietly restructure a module.
     * 3. One document only. `material` is a single source's extracted text; the
     *    prompt says so as well, because a model reading a page that mentions
     *    "the slides from week 2" will otherwise teach from memory.
     *
     * Resumable in the same two phases as summarizeChapters, which matters more
     * here: a module is four sections plus its recall checks, so one call per
     * module keeps each request inside the output budget - and Khmer spends
     * roughly 3x the tokens for the same content (CLAUDE.md, AI layer).
     */
    async generateStudyGuide({
      text,
      title,
      language = 'km',
      moduleCount = 8,
      outline = null,
      only = undefined,
      serviceTier = 'default',
      onUsage,
    } = {}) {
      const material = requireFittingText(text);
      const about = title ? ` titled "${title}"` : '';

      const fullOutline =
        outline ??
        (
          await structured({
            label: 'generateStudyGuide:outline',
            schemaName: 'study_guide_outline',
            schema: STUDY_GUIDE_OUTLINE_SCHEMA,
            language,
            material,
            serviceTier,
            onUsage,
            prompt: [
              `Plan a study guide for this material${about}.`,
              `Break it into about ${moduleCount} modules, one per distinct concept it teaches,`,
              'in the order the document introduces them. Cover every major concept and do not',
              'skip technical detail.',
              'Use only this document: it is the whole syllabus for this guide, and anything it',
              'does not contain is out of scope even if you know it.',
              'Return a title and a one-line focus for each. No bodies, and no overview module.',
            ].join(' '),
          })
        ).modules;

      const wanted =
        only === undefined
          ? fullOutline.map((m) => m.moduleIndex)
          : [...new Set(only)].filter((i) => fullOutline.some((m) => m.moduleIndex === i));

      const modules = await Promise.all(
        fullOutline
          .filter((m) => wanted.includes(m.moduleIndex))
          .map(async (m) => {
            const body = await structured({
              label: `generateStudyGuide:module[${m.moduleIndex}]`,
              schemaName: 'study_guide_module',
              schema: STUDY_GUIDE_MODULE_SCHEMA,
              language,
              material,
              serviceTier,
              onUsage,
              prompt: [
                `Teach module ${m.moduleIndex}, "${m.title}", from this material${about}.`,
                `It must cover: ${m.focus}.`,
                'Teach only that - the other modules are written separately, so do not introduce',
                'their concepts or recap them.',
                'Write for a student meeting this for the first time, and write to be SKIMMED:',
                'short bullets, bold key terms, no walls of text. Being brief is not licence to',
                'drop a technical detail - cut the padding, keep the substance.',
                'Take the example from this document rather than inventing one.',
                'Every recall question must carry its own written answer, complete in one or two',
                'sentences.',
                'Do not write a summary, an overview or an introduction - start teaching.',
              ].join(' '),
            });
            return {
              moduleIndex: m.moduleIndex,
              title: body.title || m.title,
              explanationMd: body.explanationMd,
              applicationMd: body.applicationMd,
              pitfallsMd: body.pitfallsMd,
              recall: body.recall,
            };
          }),
      );

      return { outline: fullOutline, modules };
    },

    /**
     * A quiz over one document, adapted to how the student has done on it.
     *
     * Two inputs make it adaptive, and both are gathered by the caller from the
     * database rather than guessed at here:
     *
     * `avoidQuestions` — what this student has already been asked about this
     *   material. Listing them is the only way to get a genuinely new set: the
     *   model cannot know what a previous call produced, and without the list
     *   it writes the same obvious questions about the same obvious sentences
     *   every time.
     *
     * `weakTopics` — what they keep getting wrong, worst first. The 70/30 split
     *   is stated as a count rather than a percentage, because a model asked for
     *   "70%" of eight questions will cheerfully return five or six.
     *
     * Every question is multiple choice with four options. A quiz the student
     * can be re-tested on has to be comparable between rounds, and a mix of
     * true/false and written answers is not.
     */
    async generateQuiz({
      text,
      title,
      language = 'km',
      count = 10,
      difficulty = 'mixed',
      questionTypes = ['multipleChoice'],
      includeAnswerKey = true,
      avoidQuestions = [],
      weakTopics = [],
      reasoningEffort,
      onUsage,
    } = {}) {
      // Stated as counts, not percentages — see above. With no history the
      // split is 0/all, which is the "spread evenly" case.
      const targeted = weakTopics.length ? Math.round(count * 0.7) : 0;
      const general = count - targeted;

      const result = await structured({
        label: 'generateQuiz',
        schemaName: 'quiz',
        schema: QUIZ_SCHEMA,
        language,
        material: text,
        reasoningEffort,
        onUsage,
        prompt: [
          `Write exactly ${count} questions about this material at ${difficulty} difficulty.`,
          `Allowed question types only: ${questionTypes.join(', ')}.`,
          `${title ? `titled "${title}"` : ''}.`,
          'Use only this document — not your own knowledge of the subject, and not any other',
          'file it may refer to.',
          'Do not ask questions about the class name, source labels, filenames, or the fact that',
          'a document was supplied. Ask about concepts, definitions, procedures, and examples',
          'stated in the document itself.',
          'For multipleChoice, use kind "multiple_choice" with exactly 4 options and exactly one correctIndex.',
          'For trueFalse, use kind "true_false" with exactly 2 options ("True" and "False") and correctIndex.',
          'For shortAnswer, use kind "short_answer", an empty options array, and correctText.',
          'Use only allowed types and distribute them across the requested count where possible.',
          'Distractors must be plausible to someone who half-understood the material, never filler.',
          'Vary which position holds the correct option instead of writing the true statement',
          'first every time. (The server reshuffles as well, so the four options must read as',
          'a set in any order — never "all of the above", "both A and B", or an option that',
          'refers to another by letter.)',
          'Every question needs a topic and an explanation saying why the right option is right',
          'and why the others are wrong, pointing at what the document actually says.',
          weakTopics.length
            ? [
                `This student has already been tested on this material. Exactly ${targeted} of the`,
                `${count} questions must attack these weak concepts, worst first —`,
                `${weakTopics.map((topic) => `"${topic}"`).join(', ')} —`,
                'and each of those questions must set targetedWeakConcept to the concept it',
                `attacks, spelled exactly as listed. The other ${general} must cover different`,
                'parts of the document, with targetedWeakConcept null.',
              ].join(' ')
            : 'Spread the questions evenly across the core subtopics, and set targetedWeakConcept null on every one.',
          avoidQuestions.length
            ? [
                'The student has already answered the questions listed below. Do not repeat,',
                'rephrase, translate or narrowly re-angle any of them — a question testing the',
                'same fact in different words is a duplicate. Ask about something else in the',
                'document, or test the same concept from a genuinely different direction',
                '(applying it, comparing it, spotting where it breaks).',
                `ALREADY ASKED:\n${avoidQuestions.map((q) => `- ${q}`).join('\n')}`,
              ].join(' ')
            : '',
          `Title the quiz "${title ?? 'Generated Quiz'}".`,
          includeAnswerKey
            ? 'Include correct answers so the teacher can edit the answer key.'
            : 'Still include correct answers internally for validation, but the teacher UI may hide them until enabled.',
        ]
          .filter(Boolean)
          .join(' '),
      });

      return {
        title: result.title,
        questions: result.questions.map((q) => {
          const isChoice = q.kind === 'multiple_choice' || q.kind === 'true_false';
          const correctAnswer = isChoice ? q.correctIndex : q.correctText;

          if (correctAnswer === null || correctAnswer === undefined) {
            throw new Error(
              `generateQuiz: question "${q.prompt}" of kind ${q.kind} has no usable answer`,
            );
          }
          if (isChoice && (correctAnswer < 0 || correctAnswer >= q.options.length)) {
            throw new Error(
              `generateQuiz: correctIndex ${correctAnswer} is out of range for ` +
                `${q.options.length} options on "${q.prompt}"`,
            );
          }

          return {
            kind: q.kind,
            prompt: q.prompt,
            options: q.options,
            correctAnswer,
            explanation: q.explanation,
            topic: q.topic,
            // Only trust it when it names a weakness that was actually asked
            // for — a model that invents its own label would report a mix that
            // never happened.
            targetedWeakConcept: weakTopics.includes(q.targetedWeakConcept)
              ? q.targetedWeakConcept
              : null,
          };
        }),
      };
    },

    /**
     * A bank of exam questions for one document.
     *
     * Not a longer quiz. The prompt asks for coverage spread across the whole
     * document rather than clustered wherever the most quotable lines are, a
     * deliberate difficulty mix rather than one flat level, and questions that
     * test whether the student can USE the material.
     *
     * `count` is the bank, not one sitting — the student picks 5, 10 or 20 and
     * the session is drawn from this, so it must be bigger than the biggest
     * sitting.
     */
    async generateMockExam({
      text,
      title,
      language = 'km',
      count = 30,
      reasoningEffort = 'medium',
      serviceTier = 'default',
      onUsage,
    } = {}) {
      // Stated as counts rather than percentages: a model given "30% hard"
      // rounds it differently every run, and a bank that is silently 40% hard
      // makes an exam nobody can finish.
      const hard = Math.round(count * 0.25);
      const easy = Math.round(count * 0.25);
      const medium = count - hard - easy;

      const result = await structured({
        label: 'generateMockExam',
        schemaName: 'mock_exam',
        schema: MOCK_EXAM_SCHEMA,
        language,
        material: text,
        serviceTier,
        reasoningEffort,
        onUsage,
        prompt: [
          `Write exactly ${count} exam questions about this material${title ? ` from "${title}"` : ''}.`,
          'This is a mock exam, not a revision quiz. Write questions that test whether the',
          'student can USE the material — apply a rule, compare two ideas, work out what',
          'happens in a case the document did not state outright — rather than whether they',
          'can recall one sentence of it.',
          `Difficulty must be exactly ${easy} easy, ${medium} medium and ${hard} hard, and`,
          'each question must set difficulty to its own level.',
          'Spread the questions across the WHOLE document. Do not cluster them on the first',
          'few pages or on whichever section happens to be the most quotable — a section the',
          'exam never touches is a section the student will not revise.',
          'Use only this document — not your own knowledge of the subject, and not any other',
          'file it may refer to.',
          'Do not ask about the filename, the class name, source labels, or the fact that a',
          'document was supplied. Ask about concepts, definitions, procedures and examples',
          'stated in the document itself.',
          'For multiple choice use kind "multiple_choice" with exactly 4 options and one',
          'correctIndex. For true/false use kind "true_false" with exactly 2 options ("True"',
          'and "False") and correctIndex. For a question better answered in prose use kind',
          '"short_answer" with an empty options array and correctText.',
          'Distractors must be plausible to someone who half-understood the material, never',
          'filler. Vary which position holds the correct option instead of writing the true',
          'statement first every time. (The server reshuffles as well, so the four options',
          'must read as a set in any order — never "all of the above", "both A and B", or an',
          'option that refers to another by letter.)',
          'EVERY question needs expectedAnswer: the correct answer written out in full, one',
          'or two sentences, as a student would write it from memory. This applies to',
          'multiple-choice questions too — the same exam can be sat with the options hidden,',
          'and a typed answer is marked against this text. A letter or an option number there',
          'makes the question ungradeable.',
          'Every question needs a topic and an explanation saying why the right answer is',
          'right and why the others are wrong, pointing at what the document actually says.',
        ].join(' '),
      });

      return {
        title: result.title,
        questions: result.questions.map((q) => {
          const isChoice = q.kind === 'multiple_choice' || q.kind === 'true_false';
          const correctAnswer = isChoice ? q.correctIndex : q.correctText;

          if (correctAnswer === null || correctAnswer === undefined) {
            throw new Error(
              `generateMockExam: question "${q.prompt}" of kind ${q.kind} has no usable answer`,
            );
          }
          if (isChoice && (correctAnswer < 0 || correctAnswer >= q.options.length)) {
            throw new Error(
              `generateMockExam: correctIndex ${correctAnswer} is out of range for ` +
                `${q.options.length} options on "${q.prompt}"`,
            );
          }
          // An empty expectedAnswer passes strict json_schema — it is a string
          // — and would then silently mark every written response wrong, which
          // is the exact failure this field exists to prevent.
          if (typeof q.expectedAnswer !== 'string' || !q.expectedAnswer.trim()) {
            throw new Error(
              `generateMockExam: question "${q.prompt}" has no expectedAnswer to mark against`,
            );
          }

          return {
            kind: q.kind,
            prompt: q.prompt,
            options: q.options,
            correctAnswer,
            expectedAnswer: q.expectedAnswer.trim(),
            difficulty: q.difficulty,
            explanation: q.explanation,
            topic: q.topic,
          };
        }),
      };
    },

    /**
     * Marks free text on meaning rather than on wording.
     *
     * Replaces a `toLocaleLowerCase()` equality check that marked a student
     * wrong for saying the right thing in different words, and normalised Khmer
     * not at all.
     *
     * Batched: one call for the whole exam at submit, not one per answer as the
     * student types. The order of `grades` is load-bearing — it is how each
     * mark finds its question — so a count mismatch throws rather than
     * silently pairing answers with the wrong verdicts.
     *
     * `material` is the answers themselves rather than the source document:
     * grading compares a response against an expected answer, and handing over
     * the whole document would invite the model to mark against what it thinks
     * the document says instead of against the answer key.
     */
    async gradeWrittenAnswers({ answers = [], language = 'km', reasoningEffort = 'low', onUsage } = {}) {
      if (answers.length === 0) return [];

      const material = answers
        .map((a, i) => [
          `### Answer ${i + 1}`,
          `QUESTION: ${a.prompt}`,
          `EXPECTED: ${a.expectedAnswer}`,
          `STUDENT WROTE: ${a.response}`,
        ].join('\n'))
        .join('\n\n');

      const result = await structured({
        label: 'gradeWrittenAnswers',
        schemaName: 'written_grades',
        schema: WRITTEN_GRADES_SCHEMA,
        language,
        material,
        reasoningEffort,
        onUsage,
        prompt: [
          `Mark these ${answers.length} exam answers. Return exactly ${answers.length} grades,`,
          'in the same order as the answers appear.',
          'Mark on MEANING, not on wording. A student who conveys the expected answer in their',
          'own words is correct. Different phrasing, different word order, a different example,',
          'spelling mistakes, and mixing Khmer with English technical terms are all correct.',
          'Khmer has no spaces between words, so do not treat spacing as a mistake.',
          'Mark incorrect only when the response misses, contradicts or fails to reach the',
          'substance of the expected answer. An answer that is right but incomplete on a minor',
          'point is correct — say what was missing in the note.',
          'An empty or irrelevant response is incorrect.',
          'Do not reward length. A short answer that is right is right.',
          'Every note is one short line addressed to the student, in their language.',
        ].join(' '),
      });

      const grades = result.grades ?? [];
      if (grades.length !== answers.length) {
        throw new Error(
          `gradeWrittenAnswers: expected ${answers.length} grades, got ${grades.length}`,
        );
      }
      return grades.map((grade) => ({
        isCorrect: Boolean(grade.isCorrect),
        note: typeof grade.note === 'string' ? grade.note.trim() : '',
      }));
    },

    async generateFlashcards({ text, language = 'km', count = 12, reasoningEffort = 'none', onUsage } = {}) {
      const result = await structured({
        label: 'generateFlashcards',
        schemaName: 'flashcards',
        schema: FLASHCARDS_SCHEMA,
        language,
        material: text,
        reasoningEffort,
        onUsage,
        prompt: [
          `Create ${count} flashcards from this material. term is a single concept;`,
          'definition is one or two sentences a student could recall from memory.',
          'Set hint to null unless a short nudge genuinely helps.',
        ].join(' '),
      });

      return result.cards;
    },

    async summarizeAttempt({
      language = 'km',
      correctCount = 0,
      totalQuestions = 1,
      missedTopics = [],
      quizTitle,
      onUsage,
    } = {}) {
      const result = await structured({
        label: 'summarizeAttempt',
        schemaName: 'attempt_summary',
        schema: ATTEMPT_SCHEMA,
        language,
        onUsage,
        material: JSON.stringify({ quizTitle, correctCount, totalQuestions, missedTopics }),
        prompt: [
          'A student just finished a quiz. From this result, write up to 3 short takeaways',
          'addressed to them, using the missed topics as context.',
          'Do not calculate or state a mastery percentage; the application computes it.',
        ].join(' '),
      });

      return {
        takeaways: result.takeaways,
      };
    },

    /**
     * Streaming tutor reply. Retries only cover opening the stream — once a
     * delta has been yielded, a retry would duplicate text the client already
     * rendered, so a mid-stream failure surfaces as a terminal `error` chunk.
     */
    async *tutorReply({ messages = [], language = 'km', sources = [], maxOutputTokens = 400, onUsage } = {}) {
      const grounding = requireFittingText(
        sources.map((s) => `[${s.title}]\n${s.content}`).join('\n\n'),
      );

      let stream;
      try {
        stream = await chatCompletion('tutorReply', (skip) => ({
          model,
          stream: true,
          // Without this the stream reports no usage at all and every tutor
          // turn would log as zero tokens — the most-used AI path costing
          // nothing on paper.
          ...(!skip.has('stream_options') && { stream_options: { include_usage: true } }),
          max_completion_tokens: outputBudget(maxOutputTokens, language),
          messages: [
            { role: 'system', content: `${systemPrompt(language)} ${TUTOR_CITATION_HINT}` },
            { role: 'system', content: `--- STUDY MATERIAL ---\n${grounding}` },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }));
      } catch (err) {
        yield { type: 'error', message: err.message };
        return;
      }

      try {
        for await (const part of stream) {
          // The usage-bearing chunk arrives last and carries an empty choices
          // array, so it is reported rather than yielded as a delta.
          if (part.usage) reportUsage(onUsage, part.usage, model);

          const text = part.choices[0]?.delta?.content;
          if (text) yield { type: 'delta', text };
        }
      } catch (err) {
        yield { type: 'error', message: `Stream interrupted: ${err.message}` };
        return;
      }

      // Citations come from the chunks the service retrieved, not from the
      // model — a streamed reply carries no structured citation block, and
      // echoing back what we already know is more reliable than parsing prose.
      yield {
        type: 'done',
        citations: sources.map((s) => ({
          sourceTitle: s.title,
          pageNumber: s.pageNumber ?? null,
          startSeconds: s.startSeconds ?? null,
        })),
        suggestedFollowups: [],
      };
    },

    /**
     * Reads the text off photographed study material.
     *
     * Not routed through `structured`, because that helper puts one text blob
     * in the user turn and the material here is images. Same strict json_schema
     * contract and the same usage reporting; only the message parts differ.
     *
     * Two prompt decisions worth keeping:
     *
     * A photo of Khmer notes is normally peppered with English technical terms,
     * so the model is told to transcribe what is on the page and NOT to
     * translate into the requested language. This is the one method whose job
     * is transcription rather than writing for the student, so the system
     * prompt's "write everything in Khmer" instruction is actively wrong here —
     * following it would rewrite the source material before it was ever chunked,
     * and every summary, quiz and flashcard downstream would be built on a
     * paraphrase nobody could check against the photo.
     *
     * And it is asked to describe a diagram it cannot transcribe, because a
     * photographed graph or labelled diagram is often the whole point of the
     * page. Without that, the material is silently empty.
     */
    async extractImageText({ images = [], language = 'km', onUsage } = {}) {
      const list = (Array.isArray(images) ? images : [images]).filter(
        (image) => (image?.data?.length ?? 0) > 0,
      );

      if (list.length === 0) {
        // An empty description rather than a sentence about the absence: the
        // caller splices this into a message for the student, and "it looks
        // like No image was provided" is how that goes wrong.
        return { text: '', hasText: false, description: '' };
      }

      const completion = await chatCompletion('extractImageText', (skip) => ({
        model,
        ...(!skip.has('reasoning_effort') && { reasoning_effort: 'low' }),
        messages: [
          {
            role: 'system',
            content: [
              'You transcribe photographed study material for Cambodian students.',
              'Transcribe exactly what is written, preserving the original language of',
              'every word — Khmer notes often contain English technical terms, and those',
              'stay in English. Do not translate, correct or summarise the page.',
              'Keep the reading order, and keep headings, numbered lists and equations',
              'on their own lines.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  list.length === 1
                    ? 'Read this photograph of study material.'
                    : `Read these ${list.length} photographs as consecutive pages of one document.`,
                  `The text is expected to be mostly ${LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES.km},`,
                  'but transcribe any other language exactly as it appears.',
                  'If a diagram, chart or figure cannot be transcribed, describe it in the',
                  'description field so it is not lost.',
                ].join(' '),
              },
              // A data URL rather than a hosted link: these are a student's own
              // uploads sitting on the app's disk, and putting them behind a
              // public URL for the model to fetch would be a way of publishing
              // them. Base64 costs request size and nothing else.
              ...list.map((image) => ({
                type: 'image_url',
                image_url: {
                  url: `data:${image.mimeType};base64,${image.data.toString('base64')}`,
                  // Full resolution: handwriting and Khmer diacritics are the
                  // first thing lost when an image is downsampled, and a
                  // misread word becomes a wrong flashcard nobody can trace
                  // back to the photo.
                  detail: 'high',
                },
              })),
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'image_text', strict: true, schema: IMAGE_TEXT_SCHEMA },
        },
      }));

      reportUsage(onUsage, completion.usage, model);

      const choice = completion.choices[0];
      if (choice?.finish_reason === 'length') {
        throw new Error('extractImageText: model hit the output limit before completing the JSON');
      }
      if (choice?.message?.refusal) {
        throw new Error(`extractImageText: model refused — ${choice.message.refusal}`);
      }

      const raw = choice?.message?.content;
      if (!raw) throw new Error('extractImageText: model returned no content');

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(`extractImageText: model returned unparseable JSON (${err.message})`);
      }

      const text = (parsed.text ?? '').trim();
      return {
        text,
        // The schema cannot express "hasText implies text is non-empty", so the
        // two are reconciled here rather than left to disagree downstream.
        hasText: Boolean(parsed.hasText) && text.length > 0,
        description: (parsed.description ?? '').trim(),
      };
    },

    async embed({ texts = [], onUsage } = {}) {
      const list = Array.isArray(texts) ? texts : [texts];
      if (list.length === 0) return { embeddings: [], dimensions: EMBEDDING_DIMENSIONS };

      const embeddings = [];

      for (let start = 0; start < list.length; start += EMBED_BATCH_SIZE) {
        const batch = list.slice(start, start + EMBED_BATCH_SIZE);

        const response = await withRetry(`embed[${start}]`, () =>
          client.embeddings.create({
            model: embeddingModel,
            input: batch,
            dimensions: EMBEDDING_DIMENSIONS,
          }),
        );

        // One report per batch, so a 300-chunk document logs the calls it
        // actually made rather than one.
        reportUsage(onUsage, response.usage, embeddingModel);

        // The API may return items out of order; `index` is authoritative.
        const ordered = [...response.data].sort((a, b) => a.index - b.index);
        if (ordered.length !== batch.length) {
          throw new Error(
            `embed: asked for ${batch.length} vectors, got ${ordered.length} from ${embeddingModel}`,
          );
        }

        ordered.forEach((item, i) =>
          embeddings.push(assertEmbeddingWidth(item.embedding, `${embeddingModel}[${start + i}]`)),
        );
      }

      return { embeddings, dimensions: EMBEDDING_DIMENSIONS };
    },
  };
};
