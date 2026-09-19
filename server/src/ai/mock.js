import { createHash } from 'node:crypto';

import { EMBEDDING_DIMENSIONS, assertEmbeddingWidth } from './types.js';

/**
 * Mock AI provider.
 *
 * Every AI feature is built and tested against this until OPENAI_API_KEY
 * exists, so the shapes here are the real shapes — same fields, both languages,
 * realistic lengths. Output is deterministic (seeded off the input) so tests
 * and screenshots stay stable between runs.
 */

/** Mirrors EMBED_BATCH_SIZE in ./openai.js so mock api_calls stay comparable. */
const MOCK_EMBED_BATCH_SIZE = 96;

/**
 * Stamps generated text so it cannot be mistaken for real content.
 *
 * This exists because it already went wrong. The fixtures below describe a
 * database whatever the document says — nothing here reads `text` — and they
 * read plausibly enough that mock quizzes sat in the database looking like
 * genuine output. A student who had uploaded a chemistry paper was asked what
 * SQL stands for, and nothing on the screen said why.
 *
 * The marker is ASCII and leading, so it survives Khmer text and is the first
 * thing visible in a UI, a log line and a psql dump alike.
 */
const MOCK_MARKER = '[MOCK]';
const marked = (value) => `${MOCK_MARKER} ${value}`;

/** Says out loud that the document was never opened. */
const ignoredNote = (language, title) => (language === 'km'
  ? `${MOCK_MARKER} ខ្លឹមសារសាកល្បង — មិនបានអានឯកសារ${title ? ` "${title}"` : ''}ទេ`
  : `${MOCK_MARKER} Placeholder content — the document${title ? ` "${title}"` : ''} was not read`);

const seedFrom = (input) =>
  Number.parseInt(createHash('sha256').update(String(input)).digest('hex').slice(0, 8), 16);

/** Small deterministic PRNG so the same input always yields the same mock. */
const makeRandom = (seed) => {
  let state = seed || 1;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
};

const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];

const copy = {
  km: {
    summaryTitle: 'ទិដ្ឋភាពរួមនៃមេរៀន',
    summaryBody: [
      '## ចំណុចសំខាន់',
      '',
      'មេរៀននេះពន្យល់ពីរបៀបដែលមូលដ្ឋានទិន្នន័យរក្សាទុក និងរៀបចំព័ត៌មាន។',
      'អ្នកនឹងយល់ពីតារាង ជួរដេក ជួរឈរ និងទំនាក់ទំនងរវាងតារាងនីមួយៗ។',
      '',
      '## អ្វីដែលអ្នកនឹងរៀន',
      '',
      '- របៀបរចនាតារាងដែលមិនមានទិន្នន័យស្ទួន',
      '- តួនាទីរបស់គន្លឹះចម្បងក្នុងការកំណត់អត្តសញ្ញាណកំណត់ត្រា',
      '- របៀបសរសេរសំណួរ SQL ដើម្បីទាញយកទិន្នន័យដែលត្រូវការ',
    ].join('\n'),
    keyPoints: [
      'មូលដ្ឋានទិន្នន័យរក្សាទុកព័ត៌មានជាទម្រង់តារាង',
      'គន្លឹះចម្បងកំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗដោយឯកឯង',
      'ទំនាក់ទំនងភ្ជាប់តារាងពីរឬច្រើនចូលគ្នា',
      'សំណួរ SQL ប្រើដើម្បីទាញយក និងកែប្រែទិន្នន័យ',
      'សន្ទស្សន៍ជួយឱ្យការស្វែងរកលឿនជាងមុន',
    ],
    guideModules: [
      {
        title: 'គន្លឹះចម្បង (Primary key)',
        explanationMd: [
          '- **គន្លឹះចម្បង** កំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗដោយឯកឯង។',
          '- តម្លៃរបស់វា **មិនស្ទួន** និង **មិនទទេ** — នេះជាមូលហេតុដែលវាដំណើរការ។',
          '- បើគ្មានវាទេ កំណត់ត្រាដូចគ្នាពីរមិនអាចបែងចែកបានឡើយ។',
        ].join('\n'),
        applicationMd: [
          '```sql',
          'CREATE TABLE students (',
          '  student_id integer PRIMARY KEY,',
          '  full_name  text NOT NULL',
          ');',
          '```',
        ].join('\n'),
        pitfallsMd: [
          '- ប្រើឈ្មោះជាគន្លឹះចម្បង — សិស្សពីរនាក់អាចមានឈ្មោះដូចគ្នា។',
          '- ភ្លេចថាគន្លឹះសមាសភាគអាចត្រូវការជួរឈរច្រើន។',
          '- **គន្លឹះប្រឡង៖** តារាងមួយមានគន្លឹះចម្បងតែមួយ តែអាចមានគន្លឹះបរទេសច្រើន។',
        ].join('\n'),
        recall: [
          {
            question: 'ហេតុអ្វីលេខទូរស័ព្ទមិនសមជាគន្លឹះចម្បងសម្រាប់តារាងសិស្ស?',
            answer: 'ព្រោះវាអាចផ្លាស់ប្តូរ អាចទទេ និងអាចប្រើរួមគ្នាក្នុងគ្រួសារ។ គន្លឹះចម្បងត្រូវតែថេរ មិនទទេ និងមិនស្ទួន។',
          },
        ],
      },
      {
        title: 'ការធ្វើឱ្យធម្មតា (Normalization)',
        explanationMd: [
          '- **ការធ្វើឱ្យធម្មតា** បំបែកតារាងធំជាតារាងតូចៗគ្មានទិន្នន័យស្ទួន។',
          '- ទិន្នន័យនីមួយៗរក្សាទុក **តែម្តងគត់** នៅកន្លែងតែមួយ។',
          '- ដូច្នេះការកែម្តងគឺគ្រប់គ្រាន់ — នេះជាគោលបំណងទាំងមូល។',
        ].join('\n'),
        applicationMd: [
          '| course | teacher |',
          '| --- | --- |',
          '| Math 1 | Sokha |',
          '| Math 2 | Sokha |',
          '',
          'បំបែកជា `teachers` និង `courses` ភ្ជាប់ដោយ `teacher_id`។',
        ].join('\n'),
        pitfallsMd: [
          '- បំបែកច្រើនពេក រហូតសំណួរត្រូវការ JOIN ដប់ដង។',
          '- ភ្លេចថារបាយការណ៍ខ្លះទុកទិន្នន័យស្ទួនដោយចេតនា ដើម្បីល្បឿន។',
          '- **គន្លឹះប្រឡង៖** 3NF — ជួរឈរនីមួយៗអាស្រ័យលើគន្លឹះ តែលើគន្លឹះប៉ុណ្ណោះ។',
        ].join('\n'),
        recall: [
          {
            question: 'តើទិន្នន័យស្ទួនបង្កបញ្ហាអ្វីនៅពេលកែប្រែ?',
            answer: 'បើឈ្មោះមួយស្ថិតនៅដប់ជួរដេក ការកែម្តងនឹងទុកជួរដេកប្រាំបួនទៀតខុស — នេះហៅថា update anomaly។',
          },
        ],
      },
    ],
    chapterTitles: [
      'មូលដ្ឋានគ្រឹះនៃមូលដ្ឋានទិន្នន័យ',
      'គំរូទិន្នន័យ និងគ្រោងការណ៍',
      'មូលដ្ឋានទិន្នន័យទំនាក់ទំនង',
      'មូលដ្ឋានគ្រឹះនៃ SQL',
      'សន្ទស្សន៍ និងដំណើរការ',
      'ការធ្វើឱ្យធម្មតា',
      'ប្រតិបត្តិការ',
      'ការរចនាគ្រោងការណ៍',
      'សំណួរកម្រិតខ្ពស់',
      'សុវត្ថិភាព និងសិទ្ធិ',
      'ការបម្រុងទុក និងការស្តារ',
      'ការអនុវត្តជាក់ស្តែង',
    ],
    tutorGreeting: 'សួស្តី! សួរខ្ញុំអំពីឯកសាររបស់អ្នកបាន។',
    tutorAnswers: [
      'គន្លឹះចម្បងគឺជាជួរឈរដែលកំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗក្នុងតារាងដោយឯកឯង។ តម្លៃរបស់វាមិនអាចស្ទួន ឬទទេបានឡើយ។',
      'តារាងមួយអាចភ្ជាប់ទៅតារាងមួយទៀតតាមរយៈគន្លឹះបរទេស ដែលចង្អុលទៅគន្លឹះចម្បងរបស់តារាងនោះ។',
      'សំណួរ SELECT ប្រើដើម្បីអានទិន្នន័យ។ អ្នកអាចបន្ថែម WHERE ដើម្បីត្រងលទ្ធផលតាមលក្ខខណ្ឌ។',
    ],
    followups: ['ពន្យល់ពី SQL JOIN', 'សង្ខេបសប្តាហ៍ទី ២', 'ផ្តល់ឧទាហរណ៍មួយ'],
    imageDescription: 'ទំព័រកត់ត្រាសរសេរដោយដៃអំពីមូលដ្ឋានទិន្នន័យ មានប្លង់តារាងមួយនៅផ្នែកខាងក្រោម។',
    imageLines: [
      'មេរៀនទី ៣ — មូលដ្ឋានទិន្នន័យទំនាក់ទំនង',
      '',
      'តារាង = ជួរដេក + ជួរឈរ',
      'គន្លឹះចម្បង (Primary Key) — តម្លៃមិនស្ទួន មិនទទេ',
      'គន្លឹះបរទេស (Foreign Key) — ចង្អុលទៅតារាងមួយទៀត',
      '',
      'ឧទាហរណ៍៖ SELECT * FROM students WHERE grade = 12;',
      '',
      'កិច្ចការផ្ទះ៖ អនុវត្តលំហាត់ទំព័រ ៤៥',
    ],
    takeaways: [
      'អ្នកយល់ពីគោលបំណងនៃមូលដ្ឋានទិន្នន័យ',
      'ត្រូវពិនិត្យឡើងវិញនូវគំនិតទំនាក់ទំនង',
      'បន្តអនុវត្តមូលដ្ឋានគ្រឹះនៃ SQL',
    ],
    terms: [
      ['មូលដ្ឋានទិន្នន័យទំនាក់ទំនង', 'មូលដ្ឋានទិន្នន័យដែលរក្សាទុកព័ត៌មានជាតារាងដែលមានទំនាក់ទំនងគ្នា'],
      ['គន្លឹះចម្បង', 'ជួរឈរដែលកំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗដោយឯកឯង'],
      ['គន្លឹះបរទេស', 'ជួរឈរដែលចង្អុលទៅគន្លឹះចម្បងនៃតារាងមួយទៀត'],
      ['សំណួរ', 'ពាក្យបញ្ជាដែលប្រើដើម្បីទាញយក ឬកែប្រែទិន្នន័យ'],
      ['សន្ទស្សន៍', 'រចនាសម្ព័ន្ធដែលធ្វើឱ្យការស្វែងរកទិន្នន័យលឿនជាងមុន'],
      ['ការធ្វើឱ្យធម្មតា', 'ដំណើរការរៀបចំទិន្នន័យដើម្បីកាត់បន្ថយការស្ទួន'],
    ],
    questions: [
      {
        prompt: 'តើគន្លឹះចម្បងមានតួនាទីអ្វី?',
        options: [
          'កំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗដោយឯកឯង',
          'រក្សាទុករូបភាព',
          'លុបតារាង',
          'បង្កើតអ្នកប្រើប្រាស់ថ្មី',
        ],
        correct: 0,
        explanation: 'គន្លឹះចម្បងធានាថាកំណត់ត្រានីមួយៗមានតម្លៃតែមួយគត់ មិនស្ទួន និងមិនទទេ។',
      },
      {
        prompt: 'តើ SQL តំណាងឱ្យអ្វី?',
        options: [
          'Structured Query Language',
          'Simple Question List',
          'System Quality Log',
          'Standard Queue Layer',
        ],
        correct: 0,
        explanation: 'SQL គឺជា Structured Query Language ដែលប្រើសម្រាប់ធ្វើការជាមួយមូលដ្ឋានទិន្នន័យទំនាក់ទំនង។',
      },
      {
        prompt: 'តារាងមួយអាចមានគន្លឹះចម្បងច្រើនជាងមួយ។',
        options: ['ពិត', 'មិនពិត'],
        correct: 1,
        explanation: 'តារាងមួយមានគន្លឹះចម្បងតែមួយប៉ុណ្ណោះ ទោះបីជាវាអាចផ្សំពីជួរឈរច្រើនក៏ដោយ។',
      },
    ],
    topics: ['មូលដ្ឋានទិន្នន័យ', 'សំណួរ SQL', 'គន្លឹះចម្បង', 'ការធ្វើឱ្យធម្មតា'],
  },

  en: {
    guideModules: [
      {
        title: 'Primary keys',
        explanationMd: [
          '- A **primary key** identifies each row uniquely.',
          '- Its values are **unique** and **never null** — that is what makes it work.',
          '- Without one, two identical rows cannot be told apart.',
        ].join('\n'),
        applicationMd: [
          '```sql',
          'CREATE TABLE students (',
          '  student_id integer PRIMARY KEY,',
          '  full_name  text NOT NULL',
          ');',
          '```',
        ].join('\n'),
        pitfallsMd: [
          '- Using a name as the key — two students can share one.',
          '- Forgetting that a composite key may need several columns.',
          '- **Exam tip:** one primary key per table, but many foreign keys.',
        ].join('\n'),
        recall: [
          {
            question: 'Why is a phone number a poor primary key for a students table?',
            answer:
              'It changes, it can be blank, and a family may share one. A primary key has to be stable, never null and unique.',
          },
        ],
      },
      {
        title: 'Normalization',
        explanationMd: [
          '- **Normalization** splits a wide table into smaller ones with no repeated data.',
          '- Each fact is then stored **exactly once**, in one place.',
          '- So correcting it once is enough — that is the whole point.',
        ].join('\n'),
        applicationMd: [
          '| course | teacher |',
          '| --- | --- |',
          '| Math 1 | Sokha |',
          '| Math 2 | Sokha |',
          '',
          'Split into `teachers` and `courses`, joined by `teacher_id`.',
        ].join('\n'),
        pitfallsMd: [
          '- Splitting so far that ordinary queries need ten joins.',
          '- Forgetting that reporting tables duplicate data on purpose, for speed.',
          '- **Exam tip:** 3NF — every column depends on the key, the whole key, nothing but the key.',
        ].join('\n'),
        recall: [
          {
            question: 'What goes wrong when the same fact is stored in ten rows?',
            answer:
              'Correcting it once leaves the other nine wrong. That is an update anomaly, and it is what normalization removes.',
          },
        ],
      },
    ],
    summaryTitle: 'Course overview',
    summaryBody: [
      '## The main idea',
      '',
      'This lesson explains how a database stores and organises information.',
      'You will understand tables, rows, columns, and how tables relate to one another.',
      '',
      '## What you will learn',
      '',
      '- How to design tables that avoid duplicated data',
      '- What a primary key does and why every record needs one',
      '- How to write SQL queries that return exactly the rows you want',
    ].join('\n'),
    keyPoints: [
      'A database stores information in tables made of rows and columns',
      'A primary key uniquely identifies each record in a table',
      'Relationships connect two or more tables together',
      'SQL queries read and modify the stored data',
      'Indexes make lookups faster as a table grows',
    ],
    chapterTitles: [
      'Database foundations',
      'Data models and schemas',
      'Relational databases',
      'SQL fundamentals',
      'Indexing and performance',
      'Normalization',
      'Transactions',
      'Schema design',
      'Advanced queries',
      'Security and permissions',
      'Backup and recovery',
      'Putting it into practice',
    ],
    tutorGreeting: 'Hi! Ask me anything about your study kit.',
    tutorAnswers: [
      'A primary key uniquely identifies each record in a table. Its value cannot be duplicated or left empty.',
      'One table links to another through a foreign key, which points at the primary key of the table it references.',
      'A SELECT query reads data. Add a WHERE clause to filter the results down to the rows that match a condition.',
    ],
    followups: ['Explain SQL JOINs', 'Summarize Week 2', 'Give me an example'],
    imageDescription: 'A page of handwritten database notes, with a small table diagram near the bottom.',
    imageLines: [
      'Lesson 3 - Relational Databases',
      '',
      'table = rows + columns',
      'Primary Key - unique, never null',
      'Foreign Key - points at another table',
      '',
      'Example: SELECT * FROM students WHERE grade = 12;',
      '',
      'Homework: exercises on page 45',
    ],
    takeaways: [
      'You understand what a database is for',
      'Review the relational concepts',
      'Practice SQL fundamentals next',
    ],
    terms: [
      ['Relational database', 'A database that stores information in tables that relate to one another'],
      ['Primary key', 'A column whose value uniquely identifies each record in a table'],
      ['Foreign key', 'A column that points at the primary key of another table'],
      ['Query', 'A statement used to read or modify stored data'],
      ['Index', 'A structure that makes looking up rows faster'],
      ['Normalization', 'Organising data to reduce duplication'],
    ],
    questions: [
      {
        prompt: 'What does a primary key do?',
        options: [
          'Uniquely identifies each record in a table',
          'Stores image data',
          'Deletes a table',
          'Creates a new user',
        ],
        correct: 0,
        explanation: 'A primary key guarantees every record has one unique, non-null identifying value.',
      },
      {
        prompt: 'What does SQL stand for?',
        options: [
          'Structured Query Language',
          'Simple Question List',
          'System Quality Log',
          'Standard Queue Layer',
        ],
        correct: 0,
        explanation: 'SQL is Structured Query Language, used to work with relational databases.',
      },
      {
        prompt: 'A table can have more than one primary key.',
        options: ['True', 'False'],
        correct: 1,
        explanation: 'A table has exactly one primary key, though that key may be composed of several columns.',
      },
    ],
    topics: ['Databases', 'SQL queries', 'Primary keys', 'Normalization'],
  },
};

const dict = (language) => copy[language] ?? copy.km;

/** Derives evenly spaced chapter boundaries, mirroring what a real model returns. */
const buildOutline = (language, chapterCount, durationSeconds) => {
  const d = dict(language);
  const count = Math.min(Math.max(chapterCount, 1), d.chapterTitles.length);
  const span = Math.max(60, Math.floor((durationSeconds || count * 900) / count));

  return Array.from({ length: count }, (_, i) => ({
    chapterIndex: i + 1,
    title: d.chapterTitles[i],
    startSeconds: i * span,
    endSeconds: (i + 1) * span,
  }));
};

/**
 * Synthetic token counts, so the ai_generations pipeline can be exercised and
 * tested before a real key exists.
 *
 * These are ESTIMATES, not measurements. The ratio below states the hypothesis
 * CLAUDE.md wants tested rather than answering it: a byte-pair tokenizer has no
 * Khmer vocabulary, so Khmer characters cost far more tokens than Latin ones.
 * Real numbers replace these the day a key lands, which is why the
 * ai_token_ratios view excludes provider = 'mock' — averaging these in would
 * quietly corrupt the very measurement they stand in for.
 */
const CHARS_PER_TOKEN = { en: 4, km: 1 };

const estimateTokens = (text, language) => {
  const length = String(text ?? '').length;
  if (length === 0) return 0;
  return Math.max(1, Math.ceil(length / (CHARS_PER_TOKEN[language] ?? CHARS_PER_TOKEN.km)));
};

const mockUsage = ({ input = '', output = '', language = 'km', apiCalls = 1 }) => {
  const promptTokens = estimateTokens(input, language);
  const completionTokens = estimateTokens(output, language);
  return {
    promptTokens,
    completionTokens,
    reasoningTokens: 0,
    cachedPromptTokens: 0,
    totalTokens: promptTokens + completionTokens,
    apiCalls,
    model: 'mock',
  };
};

/** Same best-effort contract as the real provider (types.js, UsageReporter). */
const reportUsage = (onUsage, usage) => {
  if (typeof onUsage !== 'function') return;
  try {
    onUsage(usage);
  } catch (err) {
    console.warn(`[ai] usage reporter threw, ignoring: ${err.message}`);
  }
};

export const createMockProvider = () => ({
  name: 'mock',

  async summarize({ text, title, language = 'km', onUsage } = {}) {
    const d = dict(language);
    const result = {
      title: ignoredNote(language, title),
      bodyMd: d.summaryBody,
      keyPoints: d.keyPoints,
    };

    reportUsage(onUsage, mockUsage({ input: text, output: result.bodyMd, language }));
    return result;
  },

  /**
   * Resumable. `outline` is reused when supplied so boundaries never shift
   * between runs; `only` narrows which bodies get written.
   */
  async summarizeChapters({
    text,
    title,
    language = 'km',
    durationSeconds,
    chapterCount = 12,
    outline = null,
    only = undefined,
    onUsage,
  } = {}) {
    const d = dict(language);
    const fullOutline = outline ?? buildOutline(language, chapterCount, durationSeconds);

    // Only a derived outline costs a call. A supplied one is free, which is
    // exactly why a resumed run is cheaper than the first.
    if (!outline) {
      reportUsage(
        onUsage,
        mockUsage({
          input: text,
          output: fullOutline.map((c) => c.title).join(' '),
          language,
        }),
      );
    }

    const wanted =
      only === undefined
        ? fullOutline.map((c) => c.chapterIndex)
        : [...new Set(only)].filter((i) => fullOutline.some((c) => c.chapterIndex === i));

    // One report per body, mirroring the real provider's fan-out, so api_calls
    // reflects the requests a chaptered summary actually costs.
    const chapters = fullOutline
      .filter((c) => wanted.includes(c.chapterIndex))
      .map((c) => {
        const chapter = {
          ...c,
          bodyMd: `### ${c.title}\n\n${d.summaryBody.split('\n\n')[2] ?? d.keyPoints[0]}`,
          keyPoints: d.keyPoints.slice(0, 3),
        };
        reportUsage(onUsage, mockUsage({ input: text, output: chapter.bodyMd, language }));
        return chapter;
      });

    return {
      title: title ? `${d.summaryTitle}: ${title}` : d.summaryTitle,
      bodyMd: d.summaryBody,
      outline: fullOutline,
      chapters,
    };
  },

  /**
   * Resumable in the same two phases as the real provider: a derived outline
   * costs one call, a supplied one is free, and each module body reports its
   * own usage so `api_calls` matches what a real guide would have cost.
   *
   * The fixture modules are cycled rather than repeated verbatim, so a guide
   * with eight modules reads as eight different concepts on screen instead of
   * the same card eight times.
   */
  async generateStudyGuide({
    text,
    title,
    language = 'km',
    moduleCount = 8,
    outline = null,
    only = undefined,
    onUsage,
  } = {}) {
    const d = dict(language);
    const random = makeRandom(seedFrom(`${title ?? ''}:${moduleCount}`));

    const fullOutline =
      outline ??
      Array.from({ length: Math.max(1, moduleCount) }, (_, i) => ({
        moduleIndex: i + 1,
        title: `${d.guideModules[i % d.guideModules.length].title}${i >= d.guideModules.length ? ` (${i + 1})` : ''}`,
        focus: pick(d.topics, random),
      }));

    if (!outline) {
      reportUsage(
        onUsage,
        mockUsage({ input: text, output: fullOutline.map((m) => m.title).join(' '), language }),
      );
    }

    const wanted =
      only === undefined
        ? fullOutline.map((m) => m.moduleIndex)
        : [...new Set(only)].filter((i) => fullOutline.some((m) => m.moduleIndex === i));

    const modules = fullOutline
      .filter((m) => wanted.includes(m.moduleIndex))
      .map((m) => {
        const fixture = d.guideModules[(m.moduleIndex - 1) % d.guideModules.length];
        const module = {
          moduleIndex: m.moduleIndex,
          title: m.title,
          explanationMd: fixture.explanationMd,
          applicationMd: fixture.applicationMd,
          pitfallsMd: fixture.pitfallsMd,
          recall: fixture.recall,
        };
        reportUsage(
          onUsage,
          mockUsage({
            input: text,
            output: `${module.explanationMd}${module.applicationMd}${module.pitfallsMd}`,
            language,
          }),
        );
        return module;
      });

    return { outline: fullOutline, modules };
  },

  /**
   * Adaptive, in the ways a mock can honestly be.
   *
   * It really does skip anything in `avoidQuestions` and really does aim 70% of
   * the set at `weakTopics`, so the whole adaptive path — the db reads, the
   * round key, the stored `targeted_weak_concept`, the mix on screen — can be
   * exercised end to end with no API key. What it cannot do is write a
   * genuinely new question, so once the fixtures are exhausted it re-uses a
   * prompt with a round marker rather than pretending to be inventive.
   */
  async generateQuiz({
    text,
    title,
    language = 'km',
    count = 10,
    questionTypes = ['multipleChoice'],
    difficulty = 'medium',
    avoidQuestions = [],
    weakTopics = [],
    onUsage,
  } = {}) {
    void difficulty;
    const d = dict(language);
    const seen = new Set(avoidQuestions);
    const targeted = weakTopics.length ? Math.round(count * 0.7) : 0;

    // Marked before the seen-check, not after: `avoidQuestions` holds prompts
    // read back from the database, which are already marked. Comparing a marked
    // history against unmarked fixtures would match nothing and quietly break
    // duplicate prevention.
    const stamped = d.questions.map((q) => ({ ...q, prompt: marked(q.prompt) }));
    // Every fixture that has not been asked yet, in order.
    const fresh = stamped.filter((q) => !seen.has(q.prompt));
    const pool = fresh.length ? fresh : stamped;

    const questions = Array.from({ length: Math.max(1, count) }, (_, i) => {
      const q = pool[i % pool.length];
      const cycle = Math.floor(i / pool.length);
      // The marker counts from however many the student has already been
      // asked, not from 1. Counting from 1 each time meant round two produced
      // the same "... (7)" prompts round one had already used — a mock that
      // reported duplicate prevention working while handing back duplicates.
      const prompt =
        cycle || !fresh.length ? `${q.prompt} (${seen.size + i + 1})` : q.prompt;
      const requestedType = questionTypes[i % questionTypes.length];
      const kind = requestedType === 'trueFalse'
        ? 'true_false'
        : requestedType === 'shortAnswer' ? 'short_answer' : 'multiple_choice';
      return {
        kind,
        prompt,
        options: kind === 'multiple_choice'
          ? (q.options.length === 4 ? q.options : [...q.options, 'Neither', 'Both'].slice(0, 4))
          : kind === 'true_false' ? ['True', 'False'] : [],
        correctAnswer: kind === 'short_answer' ? q.options[q.correct] : kind === 'true_false' ? (q.correct % 2) : q.correct,
        explanation: q.explanation,
        topic: i < targeted ? weakTopics[i % weakTopics.length] : d.topics[i % d.topics.length],
        targetedWeakConcept: i < targeted ? weakTopics[i % weakTopics.length] : null,
      };
    });

    reportUsage(onUsage, mockUsage({ input: text, output: JSON.stringify(questions), language }));
    return { title: ignoredNote(language, title ?? d.summaryTitle), questions };
  },

  /**
   * A stand-in exam bank.
   *
   * Cycles the same three fixtures as generateQuiz, so it is obviously fake,
   * but it produces the full shape the real method does — `expectedAnswer` and
   * `difficulty` on every question, a bank larger than one sitting — which is
   * what lets the draw, the format toggle and written grading all be exercised
   * end to end with no key configured.
   */
  async generateMockExam({ text, title, language = 'km', count = 30, onUsage } = {}) {
    const d = dict(language);
    const levels = ['easy', 'medium', 'hard'];

    const questions = Array.from({ length: Math.max(1, count) }, (_, i) => {
      const q = d.questions[i % d.questions.length];
      const cycle = Math.floor(i / d.questions.length);
      // A true/false fixture keeps its two options. Padding it to four — which
      // the quiz path does, because there the kind is chosen by the caller
      // rather than read off the fixture — produces a question labelled
      // true_false carrying four options, which validation rejects outright.
      const isTrueFalse = q.options.length === 2;
      const options = isTrueFalse
        ? q.options
        : (q.options.length === 4 ? q.options : [...q.options, 'Neither', 'Both'].slice(0, 4));
      return {
        kind: isTrueFalse ? 'true_false' : 'multiple_choice',
        // Numbered from 1 across the whole bank, so 30 questions are 30
        // distinct prompts rather than the same three repeated ten times.
        prompt: marked(cycle ? `${q.prompt} (${i + 1})` : q.prompt),
        options,
        correctAnswer: q.correct,
        // Written out in full, never a letter — the same contract the real
        // provider is held to, so written grading has something to mark
        // against here too.
        expectedAnswer: q.options[q.correct],
        difficulty: levels[i % levels.length],
        explanation: q.explanation,
        topic: d.topics[i % d.topics.length],
      };
    });

    reportUsage(onUsage, mockUsage({ input: text, output: JSON.stringify(questions), language }));
    return { title: ignoredNote(language, title ?? d.summaryTitle), questions };
  },

  async generateFlashcards({ text, language = 'km', count = 12, onUsage } = {}) {
    const d = dict(language);
    const cards = Array.from({ length: Math.max(1, count) }, (_, i) => {
      const [term, definition] = d.terms[i % d.terms.length];
      const cycle = Math.floor(i / d.terms.length);
      return {
        term: marked(cycle ? `${term} ${cycle + 1}` : term),
        definition,
        hint: null,
        topic: d.topics[i % d.topics.length],
      };
    });

    reportUsage(onUsage, mockUsage({ input: text, output: JSON.stringify(cards), language }));
    return cards;
  },

  /** Yields word-sized deltas, then exactly one terminal chunk. */
  async *tutorReply({ messages = [], language = 'km', sources = [], onUsage } = {}) {
    const d = dict(language);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const random = makeRandom(seedFrom(lastUser?.content ?? 'greeting'));
    const content = lastUser ? pick(d.tutorAnswers, random) : d.tutorGreeting;

    try {
      for (const token of content.split(/(\s+)/)) {
        if (token) yield { type: 'delta', text: token };
      }

      // Reported after the last delta, where the real provider's usage chunk
      // arrives, so a caller sees the same ordering from both.
      reportUsage(
        onUsage,
        mockUsage({
          input: [...sources.map((s) => s.content), ...messages.map((m) => m.content)].join('\n'),
          output: content,
          language,
        }),
      );

      const cited = sources[0];
      yield {
        type: 'done',
        citations: cited
          ? [
              {
                sourceTitle: cited.title,
                pageNumber: cited.pageNumber ?? null,
                startSeconds: cited.startSeconds ?? null,
              },
            ]
          : [],
        suggestedFollowups: d.followups,
      };
    } catch (err) {
      yield { type: 'error', message: err.message };
    }
  },

  async summarizeAttempt({
    language = 'km',
    correctCount = 0,
    totalQuestions = 1,
    missedTopics = [],
    quizTitle,
    onUsage,
  } = {}) {
    const d = dict(language);

    reportUsage(
      onUsage,
      mockUsage({
        input: JSON.stringify({ quizTitle, correctCount, totalQuestions, missedTopics }),
        output: d.takeaways.join(' '),
        language,
      }),
    );

    return {
      takeaways: d.takeaways,
    };
  },

  /**
   * Canned OCR. Returns a page of study notes in the requested language, so the
   * whole photo path — chunking, embedding, summary, quiz, flashcards — runs on
   * text that looks like what a student would actually photograph.
   *
   * One behaviour here is real rather than canned: an image of zero bytes comes
   * back `hasText: false`. That is the branch the ingest service has to handle
   * and the one a canned success would hide, so it stays reachable without a
   * key. Everything else is fixed copy.
   */
  async extractImageText({ images = [], language = 'km', onUsage } = {}) {
    const d = dict(language);
    const list = Array.isArray(images) ? images : [images];
    const readable = list.filter((image) => (image?.data?.length ?? 0) > 0);

    if (readable.length === 0) {
      reportUsage(onUsage, mockUsage({ input: '', output: '', language, apiCalls: 1 }));
      // Empty, not the canned note description — the caller splices this into
      // a message, and describing a page that was never read would be a lie
      // the mock has no business telling.
      return { text: '', hasText: false, description: '' };
    }

    // Each image is a page, joined the way the real provider is told to join
    // them, so a multi-page note chunks identically either way.
    const text = readable.map(() => d.imageLines.join('\n')).join('\n\n');

    reportUsage(
      onUsage,
      mockUsage({
        // Image tokens are not text tokens; the real provider reports what the
        // API charged. The mock has no basis for a number, so it counts only
        // what it produced and leaves the input at zero rather than inventing
        // a figure that would land in ai_generations looking measured.
        input: '',
        output: text,
        language,
        apiCalls: readable.length,
      }),
    );

    return { text, hasText: true, description: d.imageDescription };
  },

  /**
   * Deterministic pseudo-embeddings: the same text always maps to the same unit
   * vector, and different texts map to different ones. Enough to exercise the
   * pgvector column and the retrieval plumbing end to end — but NOT semantic,
   * so nearest-neighbour relevance can only be judged against a real provider.
   */
  async embed({ texts = [], onUsage } = {}) {
    const list = Array.isArray(texts) ? texts : [texts];
    const embeddings = list.map((text, i) => {
      const random = makeRandom(seedFrom(text));
      const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => random() * 2 - 1);
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
      return assertEmbeddingWidth(
        vector.map((value) => value / norm),
        `mock embedding[${i}]`,
      );
    });

    // Embeddings bill input only. apiCalls mirrors the real provider's batch
    // size so a 300-chunk document does not look like a single request.
    reportUsage(
      onUsage,
      mockUsage({
        input: list.join(''),
        output: '',
        language: 'en',
        apiCalls: Math.max(1, Math.ceil(list.length / MOCK_EMBED_BATCH_SIZE)),
      }),
    );

    return { embeddings, dimensions: EMBEDDING_DIMENSIONS };
  },
});
