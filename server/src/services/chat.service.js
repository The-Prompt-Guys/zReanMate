import { getAI } from '../ai/index.js';
import { chatDb } from '../db/chat.db.js';
import { chunksDb } from '../db/chunks.db.js';
import { ApiError } from '../middleware/errors.js';
import { plansService } from './plans.service.js';
import {
  detectCostLanguage,
  recordStreamedGeneration,
  trackGeneration,
} from './aiUsage.service.js';
import { createUsageCollector } from '../ai/types.js';

const active = new Map();
const nextTick = () => new Promise((resolve) => setImmediate(resolve));

const toMessage = (row) => ({
  id: row.id,
  role: row.role,
  content: row.content,
  citations: row.citations ?? [],
  status: row.status,
  createdAt: row.created_at,
});

const publish = (entry, event, data) => {
  if (entry.terminal) return;
  const frame = { id: event === 'delta' ? String(++entry.sequence) : 'terminal', event, data };
  entry.frames.push(frame);
  if (event === 'done' || event === 'error') entry.terminal = true;
  for (const subscriber of entry.subscribers) subscriber(frame);
};

const runProducer = async (session, entry) => {
  const ai = getAI();
  let answer = '';

  // A tutor turn is the most-used AI path, so its cost is recorded even when
  // the stream dies partway: the tokens were still spent. History and sources
  // are hoisted so the failure path can describe the call it was making.
  const usage = createUsageCollector();
  const startedAt = Date.now();
  let history = [];
  let sources = [];
  let logged = false;

  const logTurn = async (status, errorMessage = null) => {
    if (logged) return;
    logged = true;
    await recordStreamedGeneration({
      kind: 'tutor',
      userId: session.user_id,
      studyKitId: session.study_kit_id,
      language: session.language,
      sourceText: sources.map((item) => item.content).join('\n'),
      request: { retrievedSources: sources.length, historyTurns: history.length, maxOutputTokens: 400 },
      response: { answerChars: answer.length },
      status,
      errorMessage,
      usageTotal: usage.total(),
      startedAt,
    });
  };

  try {
    history = await chatDb.recentHistory(session.conversation_id, 4);
    const queryText = [...history].reverse().find((message) => message.role === 'user')?.content ?? '';

    // Logged as its own 'embedding' row rather than folded into the tutor
    // total: it runs on a different model, and mixing the two would attribute
    // the turn's tokens to whichever model reported first.
    const embedded = await trackGeneration(
      {
        kind: 'embedding',
        userId: session.user_id,
        studyKitId: session.study_kit_id,
        language: detectCostLanguage(queryText) ?? session.language,
        sourceText: queryText,
        request: { purpose: 'tutor_retrieval', chunks: 1 },
        describe: (value) => ({ vectors: value.embeddings?.length ?? 0 }),
      },
      ({ onUsage }) => ai.embed({ texts: [queryText], onUsage }),
    );

    const matches = await chunksDb.cosineSearchForKit({ kitId: session.study_kit_id, embedding: embedded.embeddings[0], limit: 3 });
    sources = matches.map((row) => ({
      title: row.title,
      content: row.content,
      pageNumber: row.page_number,
      startSeconds: row.start_seconds,
    }));

    let terminalSeen = false;
    let streamError = null;
    for await (const chunk of ai.tutorReply({ messages: history, language: session.language, sources, maxOutputTokens: 400, onUsage: usage.record })) {
      if (terminalSeen) continue;
      if (chunk.type === 'delta') {
        answer += chunk.text;
        publish(entry, 'delta', { text: chunk.text });
        // Yield to the socket between provider deltas. This makes the mock prove
        // incremental transport instead of completing in one JavaScript turn.
        await nextTick();
      } else if (chunk.type === 'done') {
        terminalSeen = true;
        const completed = await chatDb.complete({ sessionId: session.id, content: answer, citations: chunk.citations, model: ai.name });
        if (!completed) throw new Error('The assistant message could not be completed');
        const quota = await plansService.consumeQuota(session.user_id, 'tutor_messages_per_month');
        publish(entry, 'done', {
          messageId: session.id,
          citations: chunk.citations,
          suggestedFollowups: chunk.suggestedFollowups,
          quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining },
        });
      } else if (chunk.type === 'error') {
        terminalSeen = true;
        streamError = chunk.message;
        await chatDb.fail(session.id);
        publish(entry, 'error', { code: 'generation_failed', message: chunk.message, retryable: true });
      }
    }
    // Ordered so a stream that ended without a terminal chunk falls through to
    // the catch and is recorded as failed, rather than logged 'ok' on its way
    // out. An 'error' chunk still sets terminalSeen, so it logs failed here.
    if (!terminalSeen) throw new Error('The AI stream ended without a terminal event');
    await logTurn(streamError ? 'failed' : 'ok', streamError);
  } catch (error) {
    await logTurn('failed', error.message);
    await chatDb.fail(session.id).catch(() => {});
    publish(entry, 'error', { code: 'generation_failed', message: error.message, retryable: true });
  } finally {
    active.delete(session.id);
  }
};

export const chatService = {
  async conversation(userId, kitId, language, _plan) {
    const conversation = await chatDb.conversationForKit({ userId, kitId, language });
    const messages = conversation ? await chatDb.messages(conversation.id) : [];
    const quota = (await plansService.limits(userId)).limits.tutor_messages_per_month;
    return {
      conversation: conversation ? { id: conversation.id, kitId: conversation.study_kit_id, language: conversation.language, kitTitle: conversation.kit_title, lastMessageAt: conversation.last_message_at } : null,
      messages: messages.map(toMessage),
      quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining },
    };
  },

  async create(userId, _plan, input) {
    const limit = await plansService.getLimit(userId, 'tutor_messages_per_month');
    const result = await chatDb.createSession({ userId, kitId: input.kitId, language: input.language, content: input.content, limit });
    if (result.missing) throw ApiError.notFound('That study kit does not exist');
    if (result.quotaExceeded) throw new ApiError(429, 'quota_exceeded', 'Tutor message limit reached', { used: result.used, limit: result.limit });
    return {
      sessionId: result.assistantMessage.id,
      userMessage: toMessage(result.userMessage),
      assistantMessage: toMessage(result.assistantMessage),
      quota: { used: result.used, limit: result.limit, remaining: result.limit === null ? null : result.limit - result.used },
    };
  },

  async retry(userId, _plan, sessionId) {
    const limit = await plansService.getLimit(userId, 'tutor_messages_per_month');
    const result = await chatDb.createRetry({ userId, sessionId, limit });
    if (result.missing) throw ApiError.notFound('That chat stream does not exist');
    if (result.conflict) throw ApiError.conflict('Only failed messages can be retried');
    if (result.quotaExceeded) throw new ApiError(429, 'quota_exceeded', 'Tutor message limit reached', { used: result.used, limit: result.limit });
    return { sessionId: result.assistantMessage.id, assistantMessage: toMessage(result.assistantMessage) };
  },

  async prepareStream(userId, sessionId) {
    const session = await chatDb.sessionForUser({ userId, sessionId });
    if (!session) throw ApiError.notFound('That chat stream does not exist');
    return session;
  },

  async subscribe(session, _plan, lastEventId, onFrame) {
    if (session.status === 'complete') {
      const quota = (await plansService.limits(session.user_id)).limits.tutor_messages_per_month;
      onFrame({ id: 'terminal', event: 'done', data: { messageId: session.id, citations: session.citations, suggestedFollowups: [], quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining } } });
      return () => {};
    }
    if (session.status === 'failed') {
      onFrame({ id: 'terminal', event: 'error', data: { code: 'generation_failed', message: 'The previous stream failed', retryable: true } });
      return () => {};
    }

    let entry = active.get(session.id);
    if (!entry) {
      // A streaming row with no local producer survived a process restart.
      if (session.status === 'streaming') {
        await chatDb.fail(session.id);
        onFrame({ id: 'terminal', event: 'error', data: { code: 'stream_interrupted', message: 'The server restarted during this response', retryable: true } });
        return () => {};
      }
      const claimed = await chatDb.claim(session.id);
      if (!claimed) {
        onFrame({ id: 'terminal', event: 'error', data: { code: 'stream_unavailable', message: 'This stream could not be claimed', retryable: true } });
        return () => {};
      }
      entry = { frames: [], subscribers: new Set(), sequence: 0, terminal: false };
      active.set(session.id, entry);
      void runProducer({ ...session, status: 'streaming' }, entry);
    }

    const after = Number.parseInt(lastEventId, 10) || 0;
    for (const frame of entry.frames) {
      if (frame.id === 'terminal' || Number(frame.id) > after) onFrame(frame);
    }
    if (!entry.terminal) entry.subscribers.add(onFrame);
    return () => entry.subscribers.delete(onFrame);
  },
};
