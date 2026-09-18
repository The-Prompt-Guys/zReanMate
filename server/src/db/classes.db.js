import { query, queryOne, withTransaction } from './pool.js';

const ACCESS = `(c.teacher_id = $1 OR EXISTS (
  SELECT 1 FROM class_enrollments ce
   WHERE ce.class_id = c.id AND ce.user_id = $1 AND ce.status = 'active'
))`;

const CLASS_SELECT = `
  SELECT c.id, c.teacher_id, c.title, c.description, c.subject, c.join_code,
         c.week_count, c.cover_color, c.cover_image_path, c.cover_image_mime_type,
         c.cover_image_byte_size, c.status, c.created_at,
         COALESCE(u.full_name, u.email, u.phone, 'Teacher') AS teacher_name,
         (SELECT count(*)::int FROM lessons l WHERE l.class_id = c.id) AS lesson_count,
         (SELECT count(*)::int FROM lesson_progress lp
            JOIN lessons l ON l.id = lp.lesson_id
           WHERE l.class_id = c.id AND lp.user_id = $1 AND lp.status = 'completed') AS lessons_done
    FROM classes c JOIN users u ON u.id = c.teacher_id`;

export const classesDb = {
  async list(userId) {
    const { rows } = await query(
      `${CLASS_SELECT} WHERE ${ACCESS} AND c.status = 'active' ORDER BY c.created_at DESC`,
      [userId],
    );
    return rows;
  },

  async detail(userId, classId) {
    return queryOne(`${CLASS_SELECT} WHERE c.id = $2 AND ${ACCESS}`, [userId, classId]);
  },

  async remove(teacherId, classId) {
    return queryOne(
      `DELETE FROM classes WHERE id = $2 AND teacher_id = $1 RETURNING id`,
      [teacherId, classId],
    );
  },

  async create({ teacherId, title, description, subject, weekCount, joinCode }) {
    return queryOne(
      `INSERT INTO classes (teacher_id, title, description, subject, week_count, join_code)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [teacherId, title, description ?? null, subject ?? null, weekCount, joinCode],
    );
  },

  async setCover({ teacherId, classId, storagePath, mimeType, byteSize }) {
    return queryOne(
      `UPDATE classes SET cover_image_path = $3, cover_image_mime_type = $4, cover_image_byte_size = $5
       WHERE id = $1 AND teacher_id = $2
       RETURNING id`,
      [classId, teacherId, storagePath, mimeType, byteSize],
    );
  },

  async cover({ userId, classId }) {
    return queryOne(
      `SELECT c.cover_image_path, c.cover_image_mime_type FROM classes c
       WHERE c.id = $2 AND ${ACCESS}`,
      [userId, classId],
    );
  },

  async join({ userId, code }) {
    return queryOne(
      `INSERT INTO class_enrollments (class_id, user_id)
       SELECT c.id, $1 FROM classes c
        WHERE c.join_code = $2 AND c.status = 'active' AND c.teacher_id <> $1
       ON CONFLICT (class_id, user_id) DO UPDATE SET status = 'active'
       RETURNING class_id`,
      [userId, code],
    );
  },

  async lessons(userId, classId) {
    const { rows } = await query(
      `SELECT l.id, l.week_number, l.position, l.title, l.description, l.kind, l.content_md,
              COALESCE(lp.status, 'not_started') AS progress_status,
              count(li.id)::int AS item_count,
              count(lip.id)::int AS completed_items,
              COALESCE(jsonb_agg(jsonb_build_object(
                'id', li.id, 'position', li.position, 'title', li.title,
                'kind', li.kind, 'contentMd', li.content_md,
                'completedAt', lip.completed_at
              ) ORDER BY li.position) FILTER (WHERE li.id IS NOT NULL), '[]'::jsonb) AS items
         FROM lessons l JOIN classes c ON c.id = l.class_id
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
         LEFT JOIN lesson_items li ON li.lesson_id = l.id
         LEFT JOIN lesson_item_progress lip ON lip.lesson_item_id = li.id AND lip.user_id = $1
        WHERE l.class_id = $2 AND ${ACCESS}
        GROUP BY l.id, lp.status
        ORDER BY l.week_number, l.position`,
      [userId, classId],
    );
    return rows;
  },

  async materials(userId, classId) {
    const { rows } = await query(
      `SELECT m.id, m.title, m.mime_type, m.byte_size,
              COALESCE(m.week_number, l.week_number, 1) AS week_number
         FROM class_materials m JOIN classes c ON c.id = m.class_id
         LEFT JOIN lessons l ON l.id = m.lesson_id
        WHERE m.class_id = $2 AND ${ACCESS}
        ORDER BY week_number, m.created_at`,
      [userId, classId],
    );
    return rows;
  },

  async quizzes(userId, classId) {
    const { rows } = await query(
      `SELECT q.id, q.title, q.question_count, q.status,
              COALESCE(l.week_number, 1) AS week_number, q.study_kit_id
         FROM quizzes q JOIN classes c ON c.id = q.class_id
         LEFT JOIN lessons l ON l.id = q.lesson_id
        WHERE q.class_id = $2 AND ${ACCESS}
        ORDER BY week_number, q.created_at`,
      [userId, classId],
    );
    return rows;
  },

  async assignments(userId, classId) {
    const { rows } = await query(
      `SELECT a.id, a.title, a.due_at, a.status, a.assignment_type,
              COALESCE(l.week_number, 1) AS week_number
         FROM assignments a JOIN classes c ON c.id = a.class_id
         LEFT JOIN lessons l ON l.id = a.lesson_id
        WHERE a.class_id = $2 AND ${ACCESS}
        ORDER BY a.due_at NULLS LAST, a.created_at`,
      [userId, classId],
    );
    return rows;
  },

  async createLesson({ teacherId, classId, lesson, items }) {
    return withTransaction(async (client) => {
      const klass = (await client.query(
        `SELECT id, week_count FROM classes WHERE id = $1 AND teacher_id = $2 FOR UPDATE`,
        [classId, teacherId],
      )).rows[0];
      if (!klass || lesson.weekNumber > klass.week_count) return null;
      const position = (await client.query(
        `SELECT COALESCE(max(position), -1) + 1 AS next FROM lessons WHERE class_id = $1 AND week_number = $2`,
        [classId, lesson.weekNumber],
      )).rows[0].next;
      const created = (await client.query(
        `INSERT INTO lessons (class_id, week_number, position, title, description, kind, content_md)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [classId, lesson.weekNumber, position, lesson.title, lesson.description ?? null,
          lesson.kind, lesson.contentMd ?? null],
      )).rows[0];
      for (const [itemPosition, item] of items.entries()) {
        await client.query(
          `INSERT INTO lesson_items (lesson_id, position, title, kind, content_md)
           VALUES ($1, $2, $3, $4, $5)`,
          [created.id, itemPosition, item.title, item.kind, item.contentMd ?? null],
        );
      }
      return created;
    });
  },

  async shareKit({ teacherId, classId, kitId }) {
    return queryOne(
      `UPDATE study_kits k SET class_id = $1
        WHERE k.id = $2 AND k.user_id = $3
          AND EXISTS (SELECT 1 FROM classes c WHERE c.id = $1 AND c.teacher_id = $3)
        RETURNING k.id, k.class_id`,
      [classId, kitId, teacherId],
    );
  },

  async completeItem({ userId, itemId }) {
    return withTransaction(async (client) => {
      const item = (await client.query(
        `SELECT li.id, li.lesson_id FROM lesson_items li
         JOIN lessons l ON l.id = li.lesson_id JOIN classes c ON c.id = l.class_id
         WHERE li.id = $1 AND EXISTS (
           SELECT 1 FROM class_enrollments ce
            WHERE ce.class_id = c.id AND ce.user_id = $2 AND ce.status = 'active'
         ) FOR UPDATE OF li`,
        [itemId, userId],
      )).rows[0];
      if (!item) return null;
      await client.query(
        `INSERT INTO lesson_item_progress (lesson_item_id, user_id)
         VALUES ($1, $2) ON CONFLICT (lesson_item_id, user_id) DO NOTHING`,
        [itemId, userId],
      );
      return (await client.query(
        `WITH counts AS (
           SELECT count(li.id)::int AS total, count(lip.id)::int AS done
             FROM lesson_items li
             LEFT JOIN lesson_item_progress lip
               ON lip.lesson_item_id = li.id AND lip.user_id = $2
            WHERE li.lesson_id = $1
         )
         INSERT INTO lesson_progress (lesson_id, user_id, status, started_at, completed_at)
         SELECT $1, $2,
                CASE WHEN done = total AND total > 0 THEN 'completed'
                     WHEN done > 0 THEN 'in_progress' ELSE 'not_started' END,
                CASE WHEN done > 0 THEN now() END,
                CASE WHEN done = total AND total > 0 THEN now() END
           FROM counts
         ON CONFLICT (lesson_id, user_id) DO UPDATE SET
           status = EXCLUDED.status,
           started_at = COALESCE(lesson_progress.started_at, EXCLUDED.started_at),
           completed_at = EXCLUDED.completed_at
         RETURNING *`,
        [item.lesson_id, userId],
      )).rows[0];
    });
  },
};
