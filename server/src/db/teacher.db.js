import { query, queryOne, withTransaction } from './pool.js';

export const teacherDb = {
  async assistantConversation({ teacherId, conversationId, classId, language }) {
    if (conversationId) {
      return queryOne(
        `SELECT id, teacher_id, class_id, language
           FROM teacher_assistant_conversations
          WHERE id = $1 AND teacher_id = $2`,
        [conversationId, teacherId],
      );
    }
    return queryOne(
      `INSERT INTO teacher_assistant_conversations (teacher_id, class_id, language)
       VALUES ($1, $2, $3)
       RETURNING id, teacher_id, class_id, language`,
      [teacherId, classId ?? null, language],
    );
  },

  async assistantMessages({ teacherId, conversationId }) {
    const { rows } = await query(
      `SELECT m.role, m.content
         FROM teacher_assistant_messages m
         JOIN teacher_assistant_conversations c ON c.id = m.conversation_id
        WHERE m.conversation_id = $1 AND c.teacher_id = $2
        ORDER BY m.created_at`,
      [conversationId, teacherId],
    );
    return rows;
  },

  async addAssistantMessage({ teacherId, conversationId, role, content }) {
    const row = await queryOne(
      `INSERT INTO teacher_assistant_messages (conversation_id, role, content)
       SELECT c.id, $3, $4
         FROM teacher_assistant_conversations c
        WHERE c.id = $2 AND c.teacher_id = $1
       RETURNING id`,
      [teacherId, conversationId, role, content],
    );
    if (row) await query(
      `UPDATE teacher_assistant_conversations SET last_message_at = now() WHERE id = $1 AND teacher_id = $2`,
      [conversationId, teacherId],
    );
    return row;
  },

  async assistantHistory(teacherId) {
    const { rows } = await query(
      `SELECT c.id, c.class_id, c.language, c.last_message_at,
              c.title, cl.title AS class_title,
              (SELECT m.content FROM teacher_assistant_messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC LIMIT 1) AS last_content
         FROM teacher_assistant_conversations c
         LEFT JOIN classes cl ON cl.id = c.class_id
        WHERE c.teacher_id = $1
        ORDER BY c.last_message_at DESC
        LIMIT 50`,
      [teacherId],
    );
    return rows;
  },

  async clearAssistantHistory(teacherId) {
    await query('DELETE FROM teacher_assistant_conversations WHERE teacher_id = $1', [teacherId]);
  },

  async dashboard(teacherId) {
    const [summary, classes, submissions] = await Promise.all([
      query(
        `SELECT
           (SELECT count(*)::int FROM classes WHERE teacher_id = $1 AND status = 'active') AS active_classes,
           (SELECT count(DISTINCT ce.user_id)::int
              FROM class_enrollments ce
              JOIN classes c ON c.id = ce.class_id
             WHERE c.teacher_id = $1 AND c.status = 'active' AND ce.status = 'active') AS total_students,
           (SELECT count(*)::int
              FROM assignment_submissions s
              JOIN assignments a ON a.id = s.assignment_id
              JOIN classes c ON c.id = a.class_id
             WHERE c.teacher_id = $1 AND s.status IN ('submitted', 'late')) AS pending_reviews,
           (SELECT count(*)::int
              FROM assignment_submissions s
              JOIN assignments a ON a.id = s.assignment_id
              JOIN classes c ON c.id = a.class_id
             WHERE c.teacher_id = $1 AND s.status = 'graded') AS returned_submissions`,
        [teacherId],
      ),
      query(
        `SELECT c.id, c.title, c.subject, c.join_code, c.cover_image_path,
                count(DISTINCT ce.user_id)::int AS student_count,
                count(DISTINCT l.id)::int AS lesson_count,
                count(DISTINCT l.id) FILTER (WHERE lp.status = 'completed')::int AS completed_lessons
           FROM classes c
           LEFT JOIN class_enrollments ce
             ON ce.class_id = c.id AND ce.status = 'active'
           LEFT JOIN lessons l ON l.class_id = c.id
           LEFT JOIN lesson_progress lp
             ON lp.lesson_id = l.id AND lp.status = 'completed'
          WHERE c.teacher_id = $1 AND c.status = 'active'
          GROUP BY c.id
          ORDER BY c.created_at DESC`,
        [teacherId],
      ),
      query(
        `SELECT a.id, a.title, a.class_id, c.title AS class_name, a.due_at,
                count(s.id)::int AS submission_count,
                count(s.id) FILTER (WHERE s.status IN ('submitted', 'late'))::int AS pending_count,
                count(s.id) FILTER (WHERE s.status = 'graded')::int AS graded_count,
                count(ce.user_id)::int AS student_count
           FROM assignments a
           JOIN classes c ON c.id = a.class_id
           LEFT JOIN class_enrollments ce
             ON ce.class_id = c.id AND ce.status = 'active'
           LEFT JOIN assignment_submissions s
             ON s.assignment_id = a.id
          WHERE c.teacher_id = $1 AND a.status <> 'draft'
          GROUP BY a.id, c.title
          ORDER BY a.due_at NULLS LAST, a.created_at DESC
          LIMIT 20`,
        [teacherId],
      ),
    ]);

    return {
      summary: summary.rows[0],
      classes: classes.rows,
      assignments: submissions.rows,
    };
  },

  async updateClass({ teacherId, classId, patch }) {
    return queryOne(
      `UPDATE classes
          SET title = COALESCE($3, title),
              description = CASE WHEN $4::boolean THEN $5 ELSE description END,
              subject = CASE WHEN $6::boolean THEN $7 ELSE subject END,
              status = COALESCE($8, status),
              updated_at = now()
        WHERE id = $2 AND teacher_id = $1
        RETURNING id, title, description, subject, join_code, week_count, cover_color, status`,
      [teacherId, classId,
        patch.title ?? null,
        Object.hasOwn(patch, 'description'), patch.description ?? null,
        Object.hasOwn(patch, 'subject'), patch.subject ?? null,
        patch.status ?? null],
    );
  },

  async students({ teacherId, classId }) {
    const { rows } = await query(
      `SELECT u.id, COALESCE(u.full_name, u.email, u.phone, 'Student') AS name,
              ce.joined_at,
              count(DISTINCT l.id)::int AS lesson_count,
              count(DISTINCT l.id) FILTER (WHERE lp.status = 'completed')::int AS completed_lessons,
              count(DISTINCT a.id)::int AS assignment_count,
              count(DISTINCT s.id) FILTER (WHERE s.status IN ('submitted', 'late', 'graded'))::int AS submitted_assignments,
              count(DISTINCT s.id) FILTER (WHERE s.status = 'graded')::int AS graded_assignments,
              COALESCE(round(avg(s.score) FILTER (WHERE s.status = 'graded'), 2), 0)::numeric AS average_score
         FROM classes c
         JOIN class_enrollments ce ON ce.class_id = c.id AND ce.status = 'active'
         JOIN users u ON u.id = ce.user_id
         LEFT JOIN lessons l ON l.class_id = c.id
         LEFT JOIN lesson_progress lp
           ON lp.lesson_id = l.id AND lp.user_id = u.id
         LEFT JOIN assignments a ON a.class_id = c.id AND a.status <> 'draft'
         LEFT JOIN assignment_submissions s
           ON s.assignment_id = a.id AND s.user_id = u.id
        WHERE c.id = $2 AND c.teacher_id = $1
        GROUP BY u.id, ce.joined_at
        ORDER BY name`,
      [teacherId, classId],
    );
    return rows;
  },

  async assignments(teacherId) {
    const { rows } = await query(
      `SELECT a.id, a.class_id, c.title AS class_name, a.title, a.description,
              a.assignment_type, a.status, a.due_at, a.points, a.question_count,
              count(ce.user_id)::int AS student_count,
              count(s.id)::int AS submission_count,
              count(s.id) FILTER (WHERE s.status IN ('submitted', 'late'))::int AS pending_count,
              count(s.id) FILTER (WHERE s.status = 'graded')::int AS graded_count
         FROM assignments a
         JOIN classes c ON c.id = a.class_id
         LEFT JOIN class_enrollments ce
           ON ce.class_id = c.id AND ce.status = 'active'
         LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
        WHERE c.teacher_id = $1
        GROUP BY a.id, c.title
        ORDER BY a.due_at NULLS LAST, a.created_at DESC`,
      [teacherId],
    );
    return rows;
  },

  async assignment({ teacherId, assignmentId }) {
    return queryOne(
      `SELECT a.id, a.class_id, a.quiz_id, a.title, a.description, a.instructions,
              a.due_at, a.points, a.question_count, a.allow_file_upload,
              a.assignment_type, a.status, c.title AS class_name,
              COALESCE(json_agg(json_build_object(
                'id', am.id, 'title', am.title, 'originalFilename', am.original_filename,
                'mimeType', am.mime_type, 'byteSize', am.byte_size
              ) ORDER BY am.created_at) FILTER (WHERE am.id IS NOT NULL), '[]') AS materials
         FROM assignments a
         JOIN classes c ON c.id = a.class_id
         LEFT JOIN assignment_materials am ON am.assignment_id = a.id
        WHERE a.id = $2 AND c.teacher_id = $1
        GROUP BY a.id, c.title`,
      [teacherId, assignmentId],
    );
  },

  async updateAssignment({ teacherId, assignmentId, input }) {
    return queryOne(
      `UPDATE assignments a
          SET title = $3,
              description = $4,
              instructions = $5::jsonb,
              due_at = $6,
              points = $7,
              status = CASE WHEN COALESCE($8, false) THEN 'published' ELSE a.status END,
              published_at = CASE WHEN COALESCE($8, false) AND a.published_at IS NULL THEN now() ELSE a.published_at END
        FROM classes c
       WHERE a.id = $2 AND a.class_id = c.id AND c.teacher_id = $1
       RETURNING a.*`,
      [teacherId, assignmentId, input.title, input.description ?? null,
        JSON.stringify(input.instructions ?? []), input.dueAt ?? null, input.points, input.publish ?? false],
    );
  },

  async deleteAssignment({ teacherId, assignmentId }) {
    return withTransaction(async (client) => {
      const materials = (await client.query(
        `SELECT am.storage_path
           FROM assignment_materials am
           JOIN assignments a ON a.id = am.assignment_id
           JOIN classes c ON c.id = a.class_id
          WHERE am.assignment_id = $2
            AND c.teacher_id = $1
            AND am.storage_path IS NOT NULL`,
        [teacherId, assignmentId],
      )).rows;
      const deleted = (await client.query(
        `DELETE FROM assignments a
          USING classes c
         WHERE a.id = $2
           AND a.class_id = c.id
           AND c.teacher_id = $1
         RETURNING a.id, a.quiz_id`,
        [teacherId, assignmentId],
      )).rows[0];
      if (!deleted) return null;

      if (deleted.quiz_id) {
        await client.query('DELETE FROM quizzes WHERE id = $1', [deleted.quiz_id]);
      }

      return { ...deleted, materials };
    });
  },

  async createAssignment({ teacherId, input }) {
    return queryOne(
      `INSERT INTO assignments
         (class_id, quiz_id, created_by, title, description, instructions, due_at,
          points, question_count, allow_file_upload, assignment_type, status, published_at)
       SELECT c.id, $3, $1, $4, $5, $6, $7, $8,
              COALESCE(q.question_count, 0), $9 = 'file', $9,
              CASE WHEN $10 THEN 'published' ELSE 'draft' END,
              CASE WHEN $10 THEN now() ELSE NULL END
         FROM classes c
         LEFT JOIN quizzes q ON q.id = $3
        WHERE c.id = $2 AND c.teacher_id = $1 AND c.status = 'active'
          AND ($9 = 'file' OR (q.id IS NOT NULL AND q.class_id = c.id))
       RETURNING *`,
      [teacherId, input.classId, input.quizId ?? null, input.title, input.description ?? null,
        JSON.stringify(input.instructions), input.dueAt ?? null, input.points ?? null,
        input.type, input.publish],
    );
  },

  async createQuiz({ teacherId, input, quiz }) {
    return withTransaction(async (client) => {
      const created = (await client.query(
        `INSERT INTO quizzes
           (class_id, created_by, title, language, difficulty, question_count, generated_by_ai, status, description)
         SELECT c.id, $1, $3, $4, 'mixed', $5, true, 'ready', $6
           FROM classes c
          WHERE c.id = $2 AND c.teacher_id = $1 AND c.status = 'active'
         RETURNING id, class_id, title, language, question_count`,
        [teacherId, input.classId, input.title, input.language, quiz.questions.length, 'Generated by ReanMate'],
      )).rows[0];
      if (!created) return null;

      for (const [position, question] of quiz.questions.entries()) {
        await client.query(
          `INSERT INTO quiz_questions
             (quiz_id, position, kind, prompt, options, correct_answer, explanation)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [created.id, position, question.kind, question.prompt,
            JSON.stringify(question.options ?? []), JSON.stringify(question.correctAnswer),
            question.explanation ?? null],
        );
      }

      const assignment = (await client.query(
        `INSERT INTO assignments
           (class_id, quiz_id, created_by, title, due_at, points, question_count,
            allow_file_upload, assignment_type, status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, 'quiz', $8,
                 CASE WHEN $8 = 'published' THEN now() ELSE NULL END)
         RETURNING id, status`,
        [created.class_id, created.id, teacherId, input.title, input.dueAt ?? null,
          input.points ?? null, quiz.questions.length, input.publish ? 'published' : 'draft'],
      )).rows[0];
      return { quiz: created, assignment };
    });
  },

  async addAssignmentAttachment({ teacherId, assignmentId, file }) {
    return queryOne(
      `INSERT INTO assignment_materials
         (assignment_id, title, original_filename, storage_path, mime_type, byte_size)
       SELECT a.id, $3, $3, $4, $5, $6
         FROM assignments a
         JOIN classes c ON c.id = a.class_id
        WHERE a.id = $2 AND c.teacher_id = $1
       RETURNING id, assignment_id, title, original_filename, mime_type, byte_size`,
      [teacherId, assignmentId, file.originalname, file.storagePath, file.mimetype, file.byteSize],
    );
  },

  async classContext({ teacherId, classId }) {
    const { rows } = await query(
      `SELECT c.title AS class_title, c.subject,
              l.title AS lesson_title, l.content_md,
              li.title AS item_title, li.content_md AS item_content
         FROM classes c
         LEFT JOIN lessons l ON l.class_id = c.id
         LEFT JOIN lesson_items li ON li.lesson_id = l.id
        WHERE c.id = $2 AND c.teacher_id = $1
        ORDER BY l.week_number, l.position, li.position`,
      [teacherId, classId],
    );
    return rows;
  },

  async materials({ teacherId, classId }) {
    const { rows } = await query(
      `SELECT m.id, m.title, m.original_filename, m.mime_type, m.byte_size, m.week_number,
              m.storage_path, m.lesson_id, m.created_at
         FROM class_materials m
         JOIN classes c ON c.id = m.class_id
        WHERE m.class_id = $2 AND c.teacher_id = $1
        ORDER BY m.created_at DESC`,
      [teacherId, classId],
    );
    return rows;
  },

  async selectedMaterials({ teacherId, classId, materialIds }) {
    if (!materialIds?.length) return [];
    const { rows } = await query(
      `SELECT m.id, m.title, m.original_filename, m.storage_path, m.mime_type
         FROM class_materials m
         JOIN classes c ON c.id = m.class_id
        WHERE c.teacher_id = $1 AND m.class_id = $2 AND m.id = ANY($3::uuid[])`,
      [teacherId, classId, materialIds],
    );
    return rows;
  },

  async materialFile({ teacherId, classId, materialId }) {
    return queryOne(
      `SELECT m.storage_path, m.mime_type, m.original_filename
         FROM class_materials m
         JOIN classes c ON c.id = m.class_id
        WHERE m.id = $3 AND m.class_id = $2 AND c.teacher_id = $1`,
      [teacherId, classId, materialId],
    );
  },

  async removeMaterial({ teacherId, classId, materialId }) {
    return queryOne(
      `DELETE FROM class_materials m
        USING classes c
       WHERE m.id = $3 AND m.class_id = c.id AND c.id = $2 AND c.teacher_id = $1
       RETURNING m.storage_path`,
      [teacherId, classId, materialId],
    );
  },

  async addMaterial({ teacherId, classId, title, weekNumber, file }) {
    return queryOne(
      `INSERT INTO class_materials
         (class_id, uploaded_by, title, week_number, original_filename, storage_path, mime_type, byte_size)
       SELECT c.id, $1, $3, $4, $5, $6, $7, $8
         FROM classes c
        WHERE c.id = $2 AND c.teacher_id = $1 AND c.status = 'active'
       RETURNING *`,
      [teacherId, classId, title, weekNumber, file.originalname, file.storagePath, file.mimetype, file.byteSize],
    );
  },
};