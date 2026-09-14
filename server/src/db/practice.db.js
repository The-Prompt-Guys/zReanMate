import { query, queryOne, withTransaction } from './pool.js';

export const practiceDb = {
  async topics({ userId, q }) {
    const { rows } = await query(
      `SELECT t.id, t.study_kit_id, t.name,
              COALESCE(m.mastery_percent, 35)::int AS effective_mastery,
              m.mastery_percent,
              COALESCE(m.attempts, 0)::int AS attempts
         FROM topics t JOIN study_kits k ON k.id = t.study_kit_id
         LEFT JOIN user_topic_mastery m ON m.topic_id = t.id AND m.user_id = $1
        WHERE k.user_id = $1 AND ($2::text IS NULL OR t.name ILIKE '%' || $2 || '%')
        ORDER BY COALESCE(m.mastery_percent, 35), t.name`, [userId, q ?? null],
    );
    return rows;
  },

  async create({ userId, input, weeklyLimit, weightedOrder }) {
    return withTransaction(async (client) => {
      await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);
      const kit = (await client.query(`SELECT id FROM study_kits WHERE id = $1 AND user_id = $2`, [input.studyKitId, userId])).rows[0];
      if (!kit) return { missing: true };
      const used = (await client.query(
        `SELECT count(*)::int AS count FROM practice_sessions
          WHERE user_id = $1 AND started_at >= date_trunc('week', now())`, [userId],
      )).rows[0].count;
      if (weeklyLimit !== null && used >= weeklyLimit) return { quotaExceeded: true, used, limit: weeklyLimit };
      if (weightedOrder.length < input.questionCount) return { insufficient: true, available: weightedOrder.length };
      const session = (await client.query(
        `INSERT INTO practice_sessions
           (user_id, study_kit_id, mode, question_count, answer_format, timer_seconds)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, input.studyKitId, input.mode, input.questionCount, input.answerFormat, input.timerSeconds],
      )).rows[0];
      for (const [index, item] of weightedOrder.slice(0, input.questionCount).entries()) {
        const options = input.answerFormat === 'written' ? [] : item.options;
        const correct = input.answerFormat === 'written' && typeof item.correct_answer === 'number'
          ? item.options[item.correct_answer] : item.correct_answer;
        await client.query(
          `INSERT INTO practice_session_questions
             (session_id, question_id, topic_id, position, prompt, options,
              correct_answer, explanation, weight_at_select)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [session.id, item.id, item.topic_id, index + 1, item.prompt,
            JSON.stringify(options), JSON.stringify(correct), item.explanation, item.weight],
        );
      }
      return { session, used, limit: weeklyLimit };
    });
  },

  async candidateQuestions({ userId, kitId, topicIds }) {
    const { rows } = await query(
      `SELECT qq.id, qq.topic_id, qq.prompt, qq.options, qq.correct_answer, qq.explanation,
              COALESCE(m.mastery_percent, 35)::int AS effective_mastery
         FROM quiz_questions qq JOIN quizzes q ON q.id = qq.quiz_id
         JOIN study_kits k ON k.id = q.study_kit_id
         LEFT JOIN user_topic_mastery m ON m.topic_id = qq.topic_id AND m.user_id = $1
        WHERE q.study_kit_id = $2 AND k.user_id = $1 AND q.status = 'ready'
          AND (cardinality($3::uuid[]) = 0 OR qq.topic_id = ANY($3::uuid[]))`,
      [userId, kitId, topicIds],
    );
    return rows;
  },

  async session({ userId, sessionId }) {
    return queryOne(`SELECT * FROM practice_sessions WHERE id = $1 AND user_id = $2`, [sessionId, userId]);
  },

  async questions(sessionId) {
    const { rows } = await query(
      `SELECT q.id, q.position, q.prompt, q.options, q.explanation, q.topic_id,
              a.response, a.is_correct, a.answered_at
         FROM practice_session_questions q
         LEFT JOIN practice_answers a ON a.session_id = q.session_id AND a.position = q.position
        WHERE q.session_id = $1 ORDER BY q.position`, [sessionId],
    );
    return rows;
  },

  async answer({ userId, sessionId, input }) {
    return withTransaction(async (client) => {
      const item = (await client.query(
        `SELECT q.*, s.status FROM practice_session_questions q
         JOIN practice_sessions s ON s.id = q.session_id
         WHERE q.session_id = $1 AND q.position = $2 AND s.user_id = $3 FOR UPDATE`,
        [sessionId, input.position, userId],
      )).rows[0];
      if (!item || item.status !== 'in_progress') return null;
      const expected = item.correct_answer;
      const correct = typeof expected === 'string'
        ? String(input.response).trim().toLocaleLowerCase() === expected.trim().toLocaleLowerCase()
        : input.response === expected;
      const saved = (await client.query(
        `INSERT INTO practice_answers
           (session_id, question_id, topic_id, position, prompt_snapshot, response, is_correct, time_spent_seconds)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (session_id, position) DO UPDATE SET response = EXCLUDED.response,
           is_correct = EXCLUDED.is_correct, time_spent_seconds = EXCLUDED.time_spent_seconds,
           answered_at = now() RETURNING *`,
        [sessionId, item.question_id, item.topic_id, input.position, item.prompt,
          JSON.stringify(input.response), correct, input.timeSpentSeconds ?? null],
      )).rows[0];
      await client.query(
        `UPDATE practice_sessions SET answered_count =
          (SELECT count(*) FROM practice_answers WHERE session_id = $1) WHERE id = $1`,
        [sessionId],
      );
      return saved;
    });
  },

  async submit({ userId, sessionId, durationSeconds }) {
    return withTransaction(async (client) => {
      const session = (await client.query(`SELECT * FROM practice_sessions WHERE id = $1 AND user_id = $2 FOR UPDATE`, [sessionId, userId])).rows[0];
      if (!session) return null;
      if (session.status === 'completed') return session;
      const stats = (await client.query(
        `SELECT count(*)::int AS answered, count(*) FILTER (WHERE is_correct)::int AS correct,
                array_remove(array_agg(DISTINCT t.name) FILTER (WHERE NOT a.is_correct), NULL) AS weak_topics
           FROM practice_answers a LEFT JOIN topics t ON t.id = a.topic_id WHERE a.session_id = $1`, [sessionId],
      )).rows[0];
      const mastery = Math.round(((stats.correct ?? 0) / Math.max(1, session.question_count)) * 100);
      const completed = (await client.query(
        `UPDATE practice_sessions SET status='completed', answered_count=$2, correct_count=$3,
           mastery_percent=$4, weak_topics=$5, duration_seconds=$6, completed_at=now()
         WHERE id=$1 RETURNING *`, [sessionId, stats.answered, stats.correct, mastery,
          JSON.stringify(stats.weak_topics ?? []), durationSeconds ?? null],
      )).rows[0];
      const topicStats = await client.query(
        `SELECT topic_id, count(*)::int AS attempts,
                count(*) FILTER (WHERE is_correct)::int AS correct
           FROM practice_answers WHERE session_id=$1 AND topic_id IS NOT NULL GROUP BY topic_id`, [sessionId],
      );
      for (const topic of topicStats.rows) {
        await client.query(
          `INSERT INTO user_topic_mastery (user_id, topic_id, attempts, correct_count, mastery_percent, last_practiced_at)
           VALUES ($1,$2,$3,$4,round($4::numeric/$3*100),now())
           ON CONFLICT (user_id, topic_id) DO UPDATE SET
             attempts=user_topic_mastery.attempts+EXCLUDED.attempts,
             correct_count=user_topic_mastery.correct_count+EXCLUDED.correct_count,
             mastery_percent=round((user_topic_mastery.correct_count+EXCLUDED.correct_count)::numeric /
               (user_topic_mastery.attempts+EXCLUDED.attempts)*100), last_practiced_at=now()`,
          [userId, topic.topic_id, topic.attempts, topic.correct],
        );
      }
      return completed;
    });
  },

  async home(userId) {
    const current = await queryOne(
      `SELECT s.id, s.study_kit_id, k.title, s.answered_count, s.question_count
       FROM practice_sessions s LEFT JOIN study_kits k ON k.id=s.study_kit_id
       WHERE s.user_id=$1 AND s.status='in_progress' ORDER BY s.started_at DESC LIMIT 1`, [userId],
    );
    return current;
  },

  async progress(userId) {
    const [daily, topics, dates] = await Promise.all([
      query(`SELECT completed_at::date AS date, sum(correct_count)::int AS correct,
                    sum(question_count)::int AS total
               FROM practice_sessions WHERE user_id=$1 AND status='completed'
              GROUP BY completed_at::date ORDER BY date`, [userId]),
      query(`SELECT t.id, t.name, m.mastery_percent, m.attempts
               FROM user_topic_mastery m JOIN topics t ON t.id=m.topic_id
              WHERE m.user_id=$1 ORDER BY m.mastery_percent, t.name`, [userId]),
      query(`SELECT DISTINCT completed_at::date AS date FROM practice_sessions
              WHERE user_id=$1 AND status='completed' ORDER BY date DESC`, [userId]),
    ]);
    return { daily: daily.rows, topics: topics.rows, dates: dates.rows.map((row) => row.date) };
  },
};
