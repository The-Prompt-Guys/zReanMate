import { query, queryOne, withTransaction } from './pool.js';

const MESSAGE_SELECT = `
  SELECT m.id, m.conversation_id, m.reply_to_message_id, m.role, m.content,
         m.citations, m.status, m.model, m.created_at`;

export const chatDb = {
  async historyForUser({ userId, language, limit = 50 }) {
    const { rows } = await query(
      `SELECT c.id, c.study_kit_id, c.source_id, c.language, c.last_message_at, c.created_at,
              k.title AS kit_title, s.title AS source_title,
              (SELECT m.content FROM chat_messages m
                WHERE m.conversation_id = c.id AND m.role = 'user'
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview
         FROM chat_conversations c
         JOIN study_kits k ON k.id = c.study_kit_id
         LEFT JOIN kit_sources s ON s.id = c.source_id
        WHERE c.user_id = $1 AND c.language = $2
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
        LIMIT $3`,
      [userId, language, limit],
    );
    return rows;
  },

  /**
   * One thread per material, so switching files and back returns to the
   * conversation you were having about each rather than one shared history.
   * `sourceId` null is the kit-wide thread.
   */
  async conversationForKit({ userId, kitId, language, sourceId = null }) {
    return queryOne(
      `SELECT c.id, c.study_kit_id, c.source_id, c.language, c.last_message_at, c.created_at,
              k.title AS kit_title, s.title AS source_title
         FROM chat_conversations c
         JOIN study_kits k ON k.id = c.study_kit_id
         LEFT JOIN kit_sources s ON s.id = c.source_id
        WHERE c.user_id = $1 AND c.study_kit_id = $2 AND c.language = $3
          AND c.source_id IS NOT DISTINCT FROM $4::uuid`,
      [userId, kitId, language, sourceId],
    );
  },

  async messages(conversationId, limit = 100) {
    const { rows } = await query(
      `${MESSAGE_SELECT} FROM chat_messages m
        WHERE m.conversation_id = $1
        ORDER BY m.created_at ASC, m.id ASC LIMIT $2`,
      [conversationId, limit],
    );
    return rows;
  },

  async recentHistory(conversationId, limit = 4) {
    const { rows } = await query(
      `SELECT role, content FROM (
         SELECT role, content, created_at, id
           FROM chat_messages
          WHERE conversation_id = $1
            AND (role = 'user' OR (role = 'assistant' AND status = 'complete'))
          ORDER BY created_at DESC, id DESC LIMIT $2
       ) recent ORDER BY created_at ASC, id ASC`,
      [conversationId, limit],
    );
    return rows;
  },

  async quota(userId, limit) {
    const row = await queryOne(
      `SELECT count(*) FILTER (WHERE m.status = 'complete')::int AS used,
              count(*) FILTER (WHERE m.status IN ('queued', 'streaming'))::int AS reserved
         FROM chat_messages m
         JOIN chat_conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $1 AND m.role = 'assistant'
          AND m.created_at >= date_trunc('month', now())`,
      [userId],
    );
    const used = row?.used ?? 0;
    return { used, limit, remaining: Math.max(0, limit - used), reserved: row?.reserved ?? 0 };
  },

  async createSession({ userId, kitId, language, content, limit, sourceId = null }) {
    return withTransaction(async (client) => {
      await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);
      const kit = (await client.query(`SELECT id, title FROM study_kits WHERE id = $1 AND user_id = $2 FOR UPDATE`, [kitId, userId])).rows[0];
      if (!kit) return { missing: true };
      const usage = (await client.query(
        `SELECT count(*) FILTER (WHERE m.status = 'complete')::int AS used,
                count(*) FILTER (WHERE m.status IN ('queued', 'streaming'))::int AS reserved
           FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id
          WHERE c.user_id = $1 AND m.role = 'assistant'
            AND m.created_at >= date_trunc('month', now())`, [userId],
      )).rows[0];
      if (limit !== null && usage.used + usage.reserved >= limit) return { quotaExceeded: true, used: usage.used, limit };

      // A source that is not in this kit is ignored rather than trusted: the
      // id arrives from the client, and a thread keyed to someone else's file
      // would retrieve from material this student never opened.
      const source = sourceId
        ? (await client.query(
            `SELECT id FROM kit_sources WHERE id = $1 AND study_kit_id = $2`,
            [sourceId, kitId],
          )).rows[0]
        : null;

      const conversation = (await client.query(
        `INSERT INTO chat_conversations (user_id, study_kit_id, source_id, title, language)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, study_kit_id, source_id, language) WHERE study_kit_id IS NOT NULL
         DO UPDATE SET title = chat_conversations.title
         RETURNING id, study_kit_id, source_id, language`,
        [userId, kitId, source?.id ?? null, kit.title, language],
      )).rows[0];
      const userMessage = (await client.query(
        `INSERT INTO chat_messages (conversation_id, role, content, status)
         VALUES ($1, 'user', $2, 'complete') RETURNING id, role, content, citations, status, created_at`,
        [conversation.id, content],
      )).rows[0];
      const assistantMessage = (await client.query(
        `INSERT INTO chat_messages (conversation_id, reply_to_message_id, role, status)
         VALUES ($1, $2, 'assistant', 'queued') RETURNING id, role, content, citations, status, created_at`,
        [conversation.id, userMessage.id],
      )).rows[0];
      await client.query(`UPDATE chat_conversations SET last_message_at = now() WHERE id = $1`, [conversation.id]);
      return { conversation, userMessage, assistantMessage, used: usage.used, limit };
    });
  },

  async createRetry({ userId, sessionId, limit }) {
    return withTransaction(async (client) => {
      await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);
      const previous = (await client.query(
        `SELECT m.id, m.reply_to_message_id, m.status, c.id AS conversation_id
           FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id
          WHERE m.id = $1 AND c.user_id = $2 AND m.role = 'assistant' FOR UPDATE`,
        [sessionId, userId],
      )).rows[0];
      if (!previous) return { missing: true };
      if (previous.status !== 'failed') return { conflict: true };
      const usage = (await client.query(
        `SELECT count(*) FILTER (WHERE m.status = 'complete')::int AS used,
                count(*) FILTER (WHERE m.status IN ('queued', 'streaming'))::int AS reserved
           FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id
          WHERE c.user_id = $1 AND m.role = 'assistant'
            AND m.created_at >= date_trunc('month', now())`, [userId],
      )).rows[0];
      if (limit !== null && usage.used + usage.reserved >= limit) return { quotaExceeded: true, used: usage.used, limit };
      const assistantMessage = (await client.query(
        `INSERT INTO chat_messages (conversation_id, reply_to_message_id, role, status)
         VALUES ($1, $2, 'assistant', 'queued') RETURNING id, role, content, citations, status, created_at`,
        [previous.conversation_id, previous.reply_to_message_id],
      )).rows[0];
      return { assistantMessage, used: usage.used, limit };
    });
  },

  async sessionForUser({ userId, sessionId }) {
    return queryOne(
      `${MESSAGE_SELECT}, c.user_id, c.study_kit_id, c.source_id, c.language
         FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id
        WHERE m.id = $1 AND c.user_id = $2 AND m.role = 'assistant'`,
      [sessionId, userId],
    );
  },

  async claim(sessionId) {
    return queryOne(`UPDATE chat_messages SET status = 'streaming' WHERE id = $1 AND status = 'queued' RETURNING id`, [sessionId]);
  },

  async complete({ sessionId, content, citations, model }) {
    return withTransaction(async (client) => {
      const row = (await client.query(
        `UPDATE chat_messages SET content = $2, citations = $3, status = 'complete', model = $4
          WHERE id = $1 AND status = 'streaming' RETURNING conversation_id`,
        [sessionId, content, JSON.stringify(citations), model],
      )).rows[0];
      if (row) await client.query(`UPDATE chat_conversations SET last_message_at = now() WHERE id = $1`, [row.conversation_id]);
      return row;
    });
  },

  async fail(sessionId) {
    await query(`UPDATE chat_messages SET status = 'failed' WHERE id = $1 AND status IN ('queued', 'streaming')`, [sessionId]);
  },
};
