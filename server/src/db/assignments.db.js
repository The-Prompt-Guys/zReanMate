import { query, queryOne, withTransaction } from './pool.js';

const ACCESS = `(c.teacher_id = $2 OR EXISTS (
  SELECT 1 FROM class_enrollments ce
   WHERE ce.class_id = c.id AND ce.user_id = $2 AND ce.status = 'active'
))`;

export const assignmentsDb = {
  async create({ teacherId, lessonId, input }) {
    return queryOne(
      `INSERT INTO assignments
         (class_id, lesson_id, quiz_id, created_by, title, description, instructions,
          due_at, points, question_count, allow_file_upload, assignment_type,
          status, published_at)
       SELECT l.class_id, l.id, $3, $1, $4, $5, $6, $7, $8,
              COALESCE(q.question_count, 0), $9 = 'file', $9, 'published', now()
         FROM lessons l JOIN classes c ON c.id = l.class_id
         LEFT JOIN quizzes q ON q.id = $3
        WHERE l.id = $2 AND c.teacher_id = $1
          AND ($9 = 'file' OR (q.id IS NOT NULL AND (q.class_id = c.id OR q.lesson_id = l.id)))
       RETURNING *`,
      [teacherId, lessonId, input.quizId ?? null, input.title, input.description ?? null,
        JSON.stringify(input.instructions), input.dueAt, input.points ?? null, input.type],
    );
  },

  async detail({ userId, assignmentId }) {
    return queryOne(
      `SELECT a.*, c.title AS class_name,
              s.id AS submission_id, COALESCE(s.status, 'not_started') AS submission_status,
              COALESCE(s.completed_questions, 0)::int AS completed_questions,
              s.answers, s.is_late, s.submitted_at, s.graded_at, s.score, s.feedback,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', am.id, 'name', am.title, 'originalFilename', am.original_filename
              ) ORDER BY am.created_at) FROM assignment_materials am
                WHERE am.assignment_id = a.id), '[]'::jsonb) AS materials,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', sf.id, 'name', sf.original_filename, 'size', sf.byte_size
              ) ORDER BY sf.uploaded_at) FROM submission_files sf
                WHERE sf.submission_id = s.id), '[]'::jsonb) AS files
         FROM assignments a JOIN classes c ON c.id = a.class_id
         LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = $2
        WHERE a.id = $1 AND ${ACCESS} AND a.status <> 'draft'`,
      [assignmentId, userId],
    );
  },

  async questions({ userId, assignmentId }) {
    const { rows } = await query(
      `SELECT qq.id, qq.position, qq.prompt, qq.options
         FROM assignments a JOIN classes c ON c.id = a.class_id
         JOIN quiz_questions qq ON qq.quiz_id = a.quiz_id
        WHERE a.id = $1 AND ${ACCESS} AND a.assignment_type = 'quiz'
        ORDER BY qq.position`,
      [assignmentId, userId],
    );
    return rows;
  },

  async saveQuiz({ userId, assignmentId, answers, submit }) {
    return withTransaction(async (client) => {
      const assignment = (await client.query(
        `SELECT a.id, a.due_at, a.question_count
           FROM assignments a JOIN classes c ON c.id = a.class_id
          WHERE a.id = $1 AND a.assignment_type = 'quiz' AND a.status = 'published'
            AND EXISTS (SELECT 1 FROM class_enrollments ce
              WHERE ce.class_id = c.id AND ce.user_id = $2 AND ce.status = 'active')
          FOR UPDATE OF a`, [assignmentId, userId],
      )).rows[0];
      if (!assignment) return null;
      const current = (await client.query(
        `SELECT * FROM assignment_submissions WHERE assignment_id = $1 AND user_id = $2 FOR UPDATE`,
        [assignmentId, userId],
      )).rows[0];
      if (current && ['submitted', 'late', 'graded'].includes(current.status)) return { terminal: true, row: current };
      const valid = (await client.query(
        `SELECT qq.id FROM assignments a JOIN quiz_questions qq ON qq.quiz_id = a.quiz_id
          WHERE a.id = $1 AND qq.id = ANY($2::uuid[])`,
        [assignmentId, Object.keys(answers)],
      )).rows;
      if (valid.length !== Object.keys(answers).length) return { invalidAnswers: true };
      const merged = { ...(current?.answers ?? {}), ...answers };
      const completed = Object.keys(merged).length;
      if (submit && completed !== assignment.question_count) return { incomplete: true };
      return { row: (await client.query(
        `INSERT INTO assignment_submissions
           (assignment_id, user_id, status, answers, completed_questions, is_late, submitted_at)
         VALUES ($1, $2,
           CASE WHEN $5 AND $4 IS NOT NULL AND now() > $4 THEN 'late'
                WHEN $5 THEN 'submitted' ELSE 'in_progress' END,
           $3, $6,
           CASE WHEN $5 THEN ($4 IS NOT NULL AND now() > $4) ELSE false END,
           CASE WHEN $5 THEN now() END)
         ON CONFLICT (assignment_id, user_id) DO UPDATE SET
           status = EXCLUDED.status, answers = EXCLUDED.answers,
           completed_questions = EXCLUDED.completed_questions,
           is_late = EXCLUDED.is_late, submitted_at = EXCLUDED.submitted_at
         RETURNING *`,
        [assignmentId, userId, JSON.stringify(merged), assignment.due_at, submit, completed],
      )).rows[0] };
    });
  },

  async addFile({ userId, assignmentId, file }) {
    return withTransaction(async (client) => {
      const assignment = (await client.query(
        `SELECT a.id, a.due_at FROM assignments a JOIN classes c ON c.id = a.class_id
          WHERE a.id = $1 AND a.assignment_type = 'file' AND a.allow_file_upload
            AND a.status = 'published' AND EXISTS (SELECT 1 FROM class_enrollments ce
              WHERE ce.class_id = c.id AND ce.user_id = $2 AND ce.status = 'active')
          FOR UPDATE OF a`, [assignmentId, userId],
      )).rows[0];
      if (!assignment) return null;
      const current = (await client.query(
        `SELECT * FROM assignment_submissions WHERE assignment_id = $1 AND user_id = $2 FOR UPDATE`,
        [assignmentId, userId],
      )).rows[0];
      if (current && ['submitted', 'late', 'graded'].includes(current.status)) return { terminal: true };
      const submission = (await client.query(
        `INSERT INTO assignment_submissions
           (assignment_id, user_id, status, is_late, submitted_at)
         VALUES ($1, $2,
           CASE WHEN $3 IS NOT NULL AND now() > $3 THEN 'late' ELSE 'submitted' END,
           $3 IS NOT NULL AND now() > $3, now())
         ON CONFLICT (assignment_id, user_id) DO UPDATE SET
           status = EXCLUDED.status, is_late = EXCLUDED.is_late, submitted_at = EXCLUDED.submitted_at
         RETURNING *`, [assignmentId, userId, assignment.due_at],
      )).rows[0];
      const saved = (await client.query(
        `INSERT INTO submission_files
           (submission_id, original_filename, storage_path, mime_type, byte_size)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [submission.id, file.originalname, file.storagePath, file.mimetype, file.byteSize],
      )).rows[0];
      return { row: submission, file: saved };
    });
  },

  async submissions({ teacherId, assignmentId }) {
    const { rows } = await query(
      `SELECT s.*, COALESCE(u.full_name, u.email, u.phone) AS student_name,
              count(sf.id)::int AS file_count
         FROM assignments a JOIN classes c ON c.id = a.class_id
         JOIN assignment_submissions s ON s.assignment_id = a.id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN submission_files sf ON sf.submission_id = s.id
        WHERE a.id = $1 AND c.teacher_id = $2
        GROUP BY s.id, u.id ORDER BY s.submitted_at NULLS LAST, s.updated_at`,
      [assignmentId, teacherId],
    );
    return rows;
  },

  async grade({ teacherId, assignmentId, submissionId, score, feedback }) {
    return queryOne(
      `UPDATE assignment_submissions s SET status = 'graded', score = $4,
              feedback = $5, graded_by = $2, graded_at = now()
        FROM assignments a JOIN classes c ON c.id = a.class_id
       WHERE s.id = $3 AND s.assignment_id = $1 AND a.id = s.assignment_id
         AND c.teacher_id = $2 AND s.status IN ('submitted', 'late')
       RETURNING s.*`,
      [assignmentId, teacherId, submissionId, score, feedback ?? null],
    );
  },
};

