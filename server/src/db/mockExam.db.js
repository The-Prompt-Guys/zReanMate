import { query, queryOne, withTransaction } from './pool.js';

export const mockExamDb = {
  /**
   * Replaces the bank for this cache row rather than adding to it.
   *
   * `quizDb.saveGenerated` inserts questions with
   * `ON CONFLICT (quiz_id, position) DO NOTHING`, which means regenerating into
   * an existing row silently keeps the OLD questions and drops every new one.
   * That is how the mock provider's canned questions survived a real key being
   * configured. Deleting first makes a regeneration actually regenerate.
   */
  async saveBank({ cacheId, source, exam, params, model }) {
    return withTransaction(async (client) => {
      const bank = (await client.query(
        `INSERT INTO mock_exam_banks
           (study_kit_id, source_id, generation_cache_id, title, language, question_count)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (generation_cache_id) WHERE generation_cache_id IS NOT NULL
         DO UPDATE SET title = EXCLUDED.title,
                       language = EXCLUDED.language,
                       question_count = EXCLUDED.question_count
         RETURNING id`,
        [source.study_kit_id, source.id, cacheId,
          `${exam.title} (${model})`, params.language, exam.questions.length],
      )).rows[0];

      await client.query(`DELETE FROM mock_exam_questions WHERE bank_id = $1`, [bank.id]);

      for (const [index, question] of exam.questions.entries()) {
        // Topics are shared with the quiz feature on purpose: mastery is
        // tracked per topic, and an exam that invented its own labels would
        // report progress against topics no practice session had ever seen.
        const topic = question.topic
          ? (await client.query(
              `INSERT INTO topics (study_kit_id, name) VALUES ($1, $2)
               ON CONFLICT (study_kit_id, name) WHERE study_kit_id IS NOT NULL
               DO UPDATE SET name = EXCLUDED.name RETURNING id`,
              [source.study_kit_id, question.topic],
            )).rows[0]
          : null;

        await client.query(
          `INSERT INTO mock_exam_questions
             (bank_id, topic_id, position, kind, prompt, options, correct_answer,
              expected_answer, difficulty, explanation, topic_label)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [bank.id, topic?.id ?? null, index + 1, question.kind, question.prompt,
            JSON.stringify(question.options), JSON.stringify(question.correctAnswer),
            question.expectedAnswer, question.difficulty, question.explanation,
            question.topic ?? null],
        );
      }

      await client.query(
        `UPDATE ai_generation_cache SET status = 'ready', error_message = NULL WHERE id = $1`,
        [cacheId],
      );
      return bank;
    });
  },

  /**
   * The exam questions available to this student.
   *
   * `sourceId` null means the whole kit — the Practice tab entry point, where
   * the exam spans every material rather than one file.
   *
   * Ownership is checked through `study_kits`, not by trusting the caller: a
   * bank id is not a capability.
   */
  async bankQuestions({ userId, kitId, sourceId = null }) {
    const { rows } = await query(
      `SELECT q.id, q.topic_id, q.prompt, q.options, q.correct_answer,
              q.expected_answer, q.difficulty, q.explanation, q.kind
         FROM mock_exam_questions q
         JOIN mock_exam_banks b ON b.id = q.bank_id
         JOIN study_kits k ON k.id = b.study_kit_id
        WHERE b.study_kit_id = $1 AND k.user_id = $2
          AND ($3::uuid IS NULL OR b.source_id = $3::uuid)
        ORDER BY q.position`,
      [kitId, userId, sourceId],
    );
    return rows;
  },

  async bankForCache(cacheId) {
    return queryOne(
      `SELECT id, title, language, question_count FROM mock_exam_banks
        WHERE generation_cache_id = $1`,
      [cacheId],
    );
  },
};
