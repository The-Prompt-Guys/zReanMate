/**
 * End-to-end check for the ai_generations cost ledger.
 *
 *   node scripts/verify-ai-usage.mjs
 *
 * Part A drives the real service helper against whichever provider is active
 * (the mock, until OPENAI_API_KEY exists) and proves rows land with token
 * counts attached.
 *
 * Part B writes rows that look like real OpenAI traffic so the ai_token_ratios
 * view can be exercised before a key exists, then deletes them again. Those
 * rows carry provider = 'openai' and would otherwise poison the very
 * measurement the view is for, so the cleanup is not optional — the script
 * fails loudly if it cannot remove them.
 */
import { getAI } from '../src/ai/index.js';
import { aiGenerationsDb } from '../src/db/aiGenerations.db.js';
import { pool, closePool } from '../src/db/pool.js';
import { detectCostLanguage, trackGeneration } from '../src/services/aiUsage.service.js';

const MARKER = 'verify-ai-usage';

const EN = 'A relational database stores information in tables of rows and columns. '.repeat(30);
const KM = 'មូលដ្ឋានទិន្នន័យរក្សាទុកព័ត៌មានជាទម្រង់តារាង។ '.repeat(30);

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

const check = (label, condition, detail = '') => {
  if (condition) console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
  else fail(`${label}${detail ? ` — ${detail}` : ''}`);
};

const run = async () => {
  const ai = getAI();
  console.log(`\nprovider: ${ai.name}\n`);

  // ---------------------------------------------------------------- part A
  console.log('A. real path through trackGeneration');

  const before = await pool.query('SELECT count(*)::int AS n FROM ai_generations');

  for (const [language, text] of [
    ['en', EN],
    ['km', KM],
  ]) {
    await trackGeneration(
      {
        kind: 'summary',
        language,
        sourceText: text,
        request: { method: 'summarize', marker: MARKER },
        describe: (s) => ({ keyPoints: s.keyPoints.length }),
      },
      ({ onUsage }) => ai.summarize({ text, language, onUsage }),
    );

    await trackGeneration(
      {
        kind: 'quiz',
        language,
        sourceText: text,
        request: { count: 10, marker: MARKER },
        describe: (q) => ({ questions: q.questions.length }),
      },
      ({ onUsage }) => ai.generateQuiz({ text, language, count: 10, onUsage }),
    );

    await trackGeneration(
      {
        kind: 'embedding',
        language,
        sourceText: text,
        request: { chunks: 120, marker: MARKER },
        describe: (e) => ({ vectors: e.embeddings.length }),
      },
      ({ onUsage }) =>
        ai.embed({ texts: Array.from({ length: 120 }, (_, i) => `${text} ${i}`), onUsage }),
    );
  }

  // A failing generation must still be recorded — it burned tokens first.
  await trackGeneration(
    { kind: 'flashcards', language: 'en', sourceText: EN, request: { marker: MARKER } },
    async ({ onUsage }) => {
      await ai.generateFlashcards({ text: EN, language: 'en', onUsage });
      throw new Error('simulated downstream failure');
    },
  ).catch(() => {});

  const after = await pool.query('SELECT count(*)::int AS n FROM ai_generations');
  check('rows inserted', after.rows[0].n - before.rows[0].n === 7, `${after.rows[0].n - before.rows[0].n} of 7`);

  const written = await pool.query(
    `SELECT kind, language, provider, model, status, prompt_tokens, completion_tokens,
            total_tokens, source_chars, api_calls, latency_ms
       FROM ai_generations
      WHERE request->>'marker' = $1
      ORDER BY language, kind`,
    [MARKER],
  );

  console.table(written.rows);

  check('every row has a provider', written.rows.every((r) => r.provider === ai.name));
  check('every row has token counts', written.rows.every((r) => r.total_tokens > 0));
  check('every row has source_chars', written.rows.every((r) => r.source_chars > 0));
  check('every row has latency', written.rows.every((r) => r.latency_ms !== null));
  check(
    'the failed generation was recorded',
    written.rows.some((r) => r.status === 'failed' && r.total_tokens > 0),
  );
  check(
    'embedding fanned out into batches',
    written.rows.filter((r) => r.kind === 'embedding').every((r) => r.api_calls === 2),
    '120 chunks / 96 per batch',
  );

  const km = written.rows.find((r) => r.kind === 'summary' && r.language === 'km');
  const en = written.rows.find((r) => r.kind === 'summary' && r.language === 'en');
  check('both languages recorded', Boolean(km && en));

  check('mock rows are hidden from the ratio view', (await aiGenerationsDb.tokenRatios({ sinceDays: 1 })).length === 0);

  // ---------------------------------------------------------------- part B
  console.log('\nB. ai_token_ratios against simulated real traffic');

  const simulated = [
    { language: 'en', promptTokens: 1200, completionTokens: 300, sourceChars: 4800 },
    { language: 'en', promptTokens: 1000, completionTokens: 250, sourceChars: 4000 },
    { language: 'km', promptTokens: 3600, completionTokens: 900, sourceChars: 4800 },
    { language: 'km', promptTokens: 3000, completionTokens: 750, sourceChars: 4000 },
  ];

  for (const row of simulated) {
    await aiGenerationsDb.insert({
      kind: 'summary',
      provider: 'openai',
      model: 'gpt-4o-mini',
      language: row.language,
      sourceChars: row.sourceChars,
      request: { marker: MARKER },
      response: {},
      status: 'ok',
      latencyMs: 1200,
      usage: {
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        reasoningTokens: 0,
        cachedPromptTokens: 0,
        totalTokens: row.promptTokens + row.completionTokens,
        apiCalls: 1,
      },
    });
  }

  const ratios = await aiGenerationsDb.tokenRatios({ sinceDays: 1 });
  console.table(ratios);

  const kmRatio = Number(ratios.find((r) => r.language === 'km')?.prompt_tokens_per_char);
  const enRatio = Number(ratios.find((r) => r.language === 'en')?.prompt_tokens_per_char);

  check('both languages appear in the view', Boolean(kmRatio && enRatio));
  check('ratios are per-character', enRatio > 0 && enRatio < 1, `en = ${enRatio}`);
  if (kmRatio && enRatio) {
    console.log(`\n  Khmer costs ${(kmRatio / enRatio).toFixed(2)}x the prompt tokens per character.`);
    console.log('  (simulated numbers — this is the shape of the answer, not the answer)');
  }

  check('detectCostLanguage reads Khmer', detectCostLanguage(KM) === 'km');
  check('detectCostLanguage reads English', detectCostLanguage(EN) === 'en');

  // ------------------------------------------------------------- cleanup
  const removed = await pool.query(`DELETE FROM ai_generations WHERE request->>'marker' = $1`, [
    MARKER,
  ]);
  console.log(`\ncleanup: removed ${removed.rowCount} rows`);

  const leftover = await pool.query(
    `SELECT count(*)::int AS n FROM ai_generations WHERE request->>'marker' = $1`,
    [MARKER],
  );
  check('no test rows left behind', leftover.rows[0].n === 0);

  const fakeReal = await pool.query(
    `SELECT count(*)::int AS n FROM ai_generations WHERE provider = 'openai'`,
  );
  check('no simulated openai rows survive', fakeReal.rows[0].n === 0, `${fakeReal.rows[0].n} found`);
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
    console.log(process.exitCode ? '\nFAILED' : '\nall checks passed');
  });
