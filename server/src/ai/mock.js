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

export const createMockProvider = () => ({
  name: 'mock',

  async summarize({ title, language = 'km' } = {}) {
    const d = dict(language);
    return {
      title: title ? `${d.summaryTitle}: ${title}` : d.summaryTitle,
      bodyMd: d.summaryBody,
      keyPoints: d.keyPoints,
    };
  },

  /**
   * Resumable. `outline` is reused when supplied so boundaries never shift
   * between runs; `only` narrows which bodies get written.
   */
  async summarizeChapters({
    title,
    language = 'km',
    durationSeconds,
    chapterCount = 12,
    outline = null,
    only = undefined,
  } = {}) {
    const d = dict(language);
    const fullOutline = outline ?? buildOutline(language, chapterCount, durationSeconds);

    const wanted =
      only === undefined
        ? fullOutline.map((c) => c.chapterIndex)
        : [...new Set(only)].filter((i) => fullOutline.some((c) => c.chapterIndex === i));

    const chapters = fullOutline
      .filter((c) => wanted.includes(c.chapterIndex))
      .map((c) => ({
        ...c,
        bodyMd: `### ${c.title}\n\n${d.summaryBody.split('\n\n')[2] ?? d.keyPoints[0]}`,
        keyPoints: d.keyPoints.slice(0, 3),
      }));

    return {
      title: title ? `${d.summaryTitle}: ${title}` : d.summaryTitle,
      bodyMd: d.summaryBody,
      outline: fullOutline,
      chapters,
    };
  },

  async generateQuiz({ title, language = 'km', count = 10 } = {}) {
    const d = dict(language);
    const questions = Array.from({ length: Math.max(1, count) }, (_, i) => {
      const q = d.questions[i % d.questions.length];
      return {
        kind: q.options.length === 2 ? 'true_false' : 'multiple_choice',
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correct,
        explanation: q.explanation,
        topic: d.topics[i % d.topics.length],
      };
    });

    return { title: title ?? d.summaryTitle, questions };
  },

  async generateFlashcards({ language = 'km', count = 12 } = {}) {
    const d = dict(language);
    return Array.from({ length: Math.max(1, count) }, (_, i) => {
      const [term, definition] = d.terms[i % d.terms.length];
      return { term, definition, hint: null, topic: d.topics[i % d.topics.length] };
    });
  },

  /** Yields word-sized deltas, then exactly one terminal chunk. */
  async *tutorReply({ messages = [], language = 'km', sources = [] } = {}) {
    const d = dict(language);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const random = makeRandom(seedFrom(lastUser?.content ?? 'greeting'));
    const content = lastUser ? pick(d.tutorAnswers, random) : d.tutorGreeting;

    try {
      for (const token of content.split(/(\s+)/)) {
        if (token) yield { type: 'delta', text: token };
      }

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

  async summarizeAttempt({ language = 'km', correctCount = 0, totalQuestions = 1, missedTopics = [] } = {}) {
    const d = dict(language);
    const masteryPercent = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
    return {
      takeaways: d.takeaways,
      masteryPercent,
      weakTopics: missedTopics.length ? missedTopics : masteryPercent < 80 ? d.topics.slice(0, 2) : [],
    };
  },

  /**
   * Deterministic pseudo-embeddings: the same text always maps to the same unit
   * vector, and different texts map to different ones. Enough to exercise the
   * pgvector column and the retrieval plumbing end to end — but NOT semantic,
   * so nearest-neighbour relevance can only be judged against a real provider.
   */
  async embed({ texts = [] } = {}) {
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

    return { embeddings, dimensions: EMBEDDING_DIMENSIONS };
  },
});
