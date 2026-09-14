import { closePool, query } from '../src/db/pool.js';

// Repair/rebuild the lesson-level rollup from the authoritative item rows.
// Safe to run repeatedly: one upsert per active student and lesson.
const RECOMPUTE = `
  WITH counts AS (
    SELECT l.id AS lesson_id, ce.user_id,
           count(li.id)::int AS total,
           count(lip.id)::int AS done
      FROM lessons l
      JOIN class_enrollments ce
        ON ce.class_id = l.class_id AND ce.status = 'active' AND ce.role = 'student'
      LEFT JOIN lesson_items li ON li.lesson_id = l.id
      LEFT JOIN lesson_item_progress lip
        ON lip.lesson_item_id = li.id AND lip.user_id = ce.user_id
     GROUP BY l.id, ce.user_id
  )
  INSERT INTO lesson_progress (lesson_id, user_id, status, started_at, completed_at)
  SELECT lesson_id, user_id,
         CASE WHEN done = total AND total > 0 THEN 'completed'
              WHEN done > 0 THEN 'in_progress' ELSE 'not_started' END,
         CASE WHEN done > 0 THEN now() END,
         CASE WHEN done = total AND total > 0 THEN now() END
    FROM counts
  ON CONFLICT (lesson_id, user_id) DO UPDATE SET
    status = EXCLUDED.status,
    started_at = COALESCE(lesson_progress.started_at, EXCLUDED.started_at),
    completed_at = CASE
      WHEN EXCLUDED.status = 'completed' THEN COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at)
      ELSE NULL
    END
  RETURNING id
`;

try {
  const result = await query(RECOMPUTE);
  console.log(`[lesson-progress] recomputed ${result.rowCount} rollup row(s)`);
} finally {
  await closePool();
}

