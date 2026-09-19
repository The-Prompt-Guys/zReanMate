/**
 * One-off repair: clear out content the mock provider wrote.
 *
 * The mock provider never reads the document. `generateQuiz` in src/ai/mock.js
 * takes `text` and passes it only to the token counter; every question comes
 * from a fixture list of three database questions. So a chemistry paper
 * ingested before OPENAI_API_KEY was set produced a quiz about SQL primary
 * keys, cached at status 'ready', which the mock exam then drew on forever.
 *
 * Migration 022 stops this recurring: `provider` is part of the cache key, so a
 * real key no longer inherits the mock's slot. This script deals with what was
 * already written.
 *
 * WHY DELETE RATHER THAN REGENERATE IN PLACE: quizDb.saveGenerated inserts
 * questions with `ON CONFLICT (quiz_id, position) DO NOTHING`. Flipping a cache
 * row back to 'pending' finds the same quiz row again and every freshly
 * generated question is silently dropped, leaving the canned ones exactly where
 * they were. The old rows have to go first.
 *
 * WHAT IS DELIBERATELY LEFT ALONE — quizzes somebody has sat:
 *   quiz_attempts.quiz_id          -> quizzes        ON DELETE CASCADE
 *   quiz_attempt_answers.question_id -> quiz_questions ON DELETE CASCADE
 * Deleting those would erase real scores from real students to tidy up
 * generated content, which is not a trade worth making. They are reported and
 * skipped. Their questions are already excluded from new sessions by the
 * provider filter in practiceDb.candidateQuestions, so leaving them costs
 * nothing but a stale row.
 *
 * practice_answers.question_id is ON DELETE SET NULL, so practice history
 * survives a delete with a null link — the prompt_snapshot column exists for
 * exactly this.
 *
 *   node scripts/purge-mock-generations.mjs          # report only
 *   node scripts/purge-mock-generations.mjs --apply  # delete
 */
import 'dotenv/config';

import { pool, query } from '../src/db/pool.js';

const apply = process.argv.includes('--apply');

const { rows: caches } = await query(
  `SELECT c.id, c.method, c.status, s.name AS source_name
     FROM ai_generation_cache c
     LEFT JOIN kit_sources s ON s.id = c.source_id
    WHERE c.provider = 'mock'
    ORDER BY c.method, c.created_at`,
);

if (caches.length === 0) {
  console.log('No mock-written generations found. Nothing to do.');
  await pool.end();
  process.exit(0);
}

const byMethod = caches.reduce((acc, row) => {
  acc[row.method] = (acc[row.method] ?? 0) + 1;
  return acc;
}, {});

console.log(`${caches.length} mock-written generation(s)${apply ? '' : ' (dry run)'}`);
for (const [method, count] of Object.entries(byMethod)) console.log(`  ${method}: ${count}`);

// Quizzes split into what can be removed and what must be preserved.
const { rows: quizzes } = await query(
  `SELECT q.id, q.title, s.name AS source_name,
          count(a.id)::int AS attempts,
          count(qq.id)::int AS questions
     FROM quizzes q
     JOIN ai_generation_cache c ON c.id = q.generation_cache_id
     LEFT JOIN kit_sources s ON s.id = c.source_id
     LEFT JOIN quiz_attempts a ON a.quiz_id = q.id
     LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
    WHERE c.provider = 'mock'
    GROUP BY q.id, q.title, s.name
    ORDER BY count(a.id) DESC, q.created_at`,
);

const sat = quizzes.filter((row) => row.attempts > 0);
const unsat = quizzes.filter((row) => row.attempts === 0);

console.log(`\n${quizzes.length} mock quiz(zes):`);
console.log(`  ${unsat.length} never sat — will be deleted`);
console.log(`  ${sat.length} with attempts — KEPT, scores preserved`);
for (const row of sat) {
  console.log(`    keep "${row.title}" (${row.source_name ?? 'source deleted'}) — ${row.attempts} attempt(s)`);
}

if (!apply) {
  console.log('\nDry run. Re-run with --apply to delete the unsat mock content.');
  await pool.end();
  process.exit(0);
}

// Deleting the cache row cascades to summaries, quizzes, flashcards and study
// guide modules that hang off it, which is the whole point — every artifact the
// mock wrote for that source goes together.
const keepCacheIds = sat.length
  ? (await query(
      `SELECT DISTINCT generation_cache_id AS id FROM quizzes WHERE id = ANY($1::uuid[])`,
      [sat.map((row) => row.id)],
    )).rows.map((row) => row.id)
  : [];

const { rowCount } = await query(
  `DELETE FROM ai_generation_cache
    WHERE provider = 'mock'
      AND NOT (id = ANY($1::uuid[]))`,
  [keepCacheIds],
);

console.log(`\nDeleted ${rowCount} mock cache row(s) and everything generated from them.`);
console.log(`Kept ${keepCacheIds.length} because a quiz under them has attempts.`);
console.log('Re-open the affected sources to regenerate against the real provider.');

await pool.end();
