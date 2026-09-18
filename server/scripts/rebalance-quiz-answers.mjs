/**
 * One-off repair: spread the correct answers in already-generated quizzes.
 *
 * Quizzes written before the shuffle landed have the correct option at A almost
 * every time — the model writes the true statement first — which a student
 * notices within a few questions, after which the quiz measures nothing.
 *
 * Only quizzes NOBODY HAS SAT are touched. A stored answer is an index into the
 * options array, so reshuffling a quiz that has attempts would silently
 * re-point every answer already recorded against it and rewrite people's
 * scores. Those are left exactly as they are; they get a fresh, balanced quiz
 * on their next round.
 *
 * Safe to run more than once: a quiz that is already balanced is left alone.
 *
 *   node scripts/rebalance-quiz-answers.mjs          # report only
 *   node scripts/rebalance-quiz-answers.mjs --apply  # write the changes
 */
import 'dotenv/config';

import { balanceAnswerPositions } from '../src/services/quiz.service.js';
import { pool, query } from '../src/db/pool.js';

const apply = process.argv.includes('--apply');

const { rows: quizzes } = await query(
  `SELECT q.id, q.title,
          count(*) FILTER (WHERE qq.kind = 'multiple_choice')::int AS choice_questions
     FROM quizzes q
     JOIN quiz_questions qq ON qq.quiz_id = q.id
    WHERE NOT EXISTS (SELECT 1 FROM quiz_attempts a WHERE a.quiz_id = q.id)
    GROUP BY q.id, q.title
   HAVING count(*) FILTER (WHERE qq.kind = 'multiple_choice') > 1
    ORDER BY q.created_at`,
);

console.log(`${quizzes.length} unattempted quiz(zes) to look at${apply ? '' : ' (dry run)'}\n`);

let changed = 0;
for (const quiz of quizzes) {
  const { rows } = await query(
    `SELECT id, position, kind, prompt, options, correct_answer, explanation, topic_label
       FROM quiz_questions WHERE quiz_id = $1 ORDER BY position`,
    [quiz.id],
  );

  const before = rows.map((row) => row.correct_answer);
  const balanced = balanceAnswerPositions(
    rows.map((row) => ({
      kind: row.kind,
      prompt: row.prompt,
      options: row.options,
      correctAnswer: row.correct_answer,
      explanation: row.explanation,
      topic: row.topic_label,
    })),
  );

  // "Spread" is about the shape of the distribution, not merely about using
  // more than one letter: nine answers on A and one on C is the same problem.
  // Anything where one position holds more than half is skewed enough to fix.
  const indices = before.filter((value) => Number.isInteger(value));
  const counts = [0, 0, 0, 0];
  for (const index of indices) counts[index] += 1;
  const worst = Math.max(...counts);

  if (indices.length < 4 || worst <= indices.length / 2) {
    console.log(
      `  skip  ${quiz.title} — ${counts.map((n, i) => `${'ABCD'[i]}:${n}`).join(' ')} is fine`,
    );
    continue;
  }

  console.log(
    `  fix   ${quiz.title} — was ${counts.map((n, i) => `${'ABCD'[i]}:${n}`).join(' ')}` +
      ` -> ${balanced.map((q) => 'ABCD'[q.correctAnswer] ?? '-').join('')}`,
  );
  changed += 1;

  if (!apply) continue;
  for (const [i, question] of balanced.entries()) {
    await query(
      `UPDATE quiz_questions SET options = $2, correct_answer = $3 WHERE id = $1`,
      [rows[i].id, JSON.stringify(question.options), JSON.stringify(question.correctAnswer)],
    );
  }
}

console.log(`\n${changed} quiz(zes) ${apply ? 'rebalanced' : 'would be rebalanced'}.`);
if (!apply && changed) console.log('Re-run with --apply to write the changes.');
await pool.end();
