/**
 * Probes the configured AI endpoint and reports what it actually supports.
 *
 *   node scripts/check-provider.mjs      (or: npm run check:provider)
 *
 * Speaking the OpenAI protocol is not the same as supporting all of it. This
 * exercises the specific things server/src/ai/openai.js depends on, one at a
 * time, so a new endpoint fails here — cheaply, with a clear reason — rather
 * than halfway through a student's first summary.
 *
 * Costs a few tokens. It never prints the API key.
 */
import OpenAI from 'openai';

import { env } from '../src/config/env.js';
import { EMBEDDING_DIMENSIONS } from '../src/ai/types.js';

const results = [];
const record = (name, status, detail) => {
  results.push({ name, status, detail });
  const mark = { pass: 'ok  ', fail: 'FAIL', warn: 'warn', skip: '--  ' }[status];
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ''}`);
};

const reason = (err) => {
  const status = err?.status ?? err?.response?.status;
  const message = err?.error?.message ?? err?.message ?? String(err);
  return status ? `${status}: ${message}` : message;
};

if (!env.openaiApiKey) {
  console.error(
    '\nOPENAI_API_KEY is empty in server/.env — nothing to check.\n' +
      'The server is running on the mock provider until it is set.\n',
  );
  process.exit(1);
}

const endpoint = env.openaiBaseUrl ?? 'https://api.openai.com/v1 (SDK default)';

console.log('\nendpoint        :', endpoint);
console.log('chat model      :', env.openaiModel);
console.log('embedding model :', env.openaiEmbeddingModel);
console.log('required width  :', EMBEDDING_DIMENSIONS, '(document_chunks.embedding)');
console.log('\nprobing:\n');

const client = new OpenAI({
  apiKey: env.openaiApiKey,
  maxRetries: 0,
  ...(env.openaiBaseUrl && { baseURL: env.openaiBaseUrl }),
});

// ---------------------------------------------------------------- reachable
let served = null;
try {
  const list = await client.models.list();
  served = list.data.map((m) => m.id);
  record('endpoint reachable', 'pass', `${served.length} models listed`);
} catch (err) {
  // Plenty of gateways omit /models. That is not fatal on its own.
  record('endpoint reachable', 'warn', `could not list models (${reason(err)})`);
}

if (served) {
  record(
    `chat model "${env.openaiModel}" is served`,
    served.includes(env.openaiModel) ? 'pass' : 'fail',
    served.includes(env.openaiModel) ? '' : `not in the list of ${served.length}`,
  );
  record(
    `embedding model "${env.openaiEmbeddingModel}" is served`,
    served.includes(env.openaiEmbeddingModel) ? 'pass' : 'fail',
    served.includes(env.openaiEmbeddingModel) ? '' : `not in the list of ${served.length}`,
  );
}

// --------------------------------------------------------------- basic chat
try {
  const completion = await client.chat.completions.create({
    model: env.openaiModel,
    max_completion_tokens: 5,
    messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
  });
  const usage = completion.usage;
  record('chat completion', 'pass', usage ? `usage reported (${usage.total_tokens} tokens)` : 'no usage block');
  if (!usage) record('chat usage reporting', 'fail', 'ai_generations would log zero tokens');
} catch (err) {
  record('chat completion', 'fail', reason(err));
}

// ------------------------------------------------- strict structured output
// Summaries, quizzes and flashcards all depend on this. No loose-JSON fallback
// exists, by design (CLAUDE.md), so failing here means three features are out.
try {
  const completion = await client.chat.completions.create({
    model: env.openaiModel,
    max_completion_tokens: 60,
    messages: [{ role: 'user', content: 'Give one key point about databases.' }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'probe',
        strict: true,
        schema: {
          type: 'object',
          properties: { keyPoint: { type: 'string' } },
          required: ['keyPoint'],
          additionalProperties: false,
        },
      },
    },
  });
  const parsed = JSON.parse(completion.choices[0].message.content);
  record(
    'strict json_schema output',
    typeof parsed.keyPoint === 'string' ? 'pass' : 'fail',
    typeof parsed.keyPoint === 'string' ? 'summaries/quizzes/flashcards OK' : 'shape did not match',
  );
} catch (err) {
  record('strict json_schema output', 'fail', `${reason(err)} — breaks summaries, quizzes, flashcards`);
}

// ------------------------------------------------------ streaming + usage
// The tutor is the most-used path; without include_usage every turn logs zero.
try {
  const stream = await client.chat.completions.create({
    model: env.openaiModel,
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: 10,
    messages: [{ role: 'user', content: 'Count to three.' }],
  });
  let deltas = 0;
  let streamUsage = null;
  for await (const part of stream) {
    if (part.usage) streamUsage = part.usage;
    if (part.choices?.[0]?.delta?.content) deltas += 1;
  }
  record('streaming', deltas > 0 ? 'pass' : 'fail', `${deltas} deltas`);
  record(
    'stream_options.include_usage',
    streamUsage ? 'pass' : 'warn',
    streamUsage ? `${streamUsage.total_tokens} tokens` : 'tutor turns will log zero tokens',
  );
} catch (err) {
  record('streaming', 'fail', reason(err));
}

// ------------------------------------------------------------ service_tier
// Sent on every summary (serviceTier 'batch' -> service_tier 'flex').
try {
  await client.chat.completions.create({
    model: env.openaiModel,
    service_tier: 'flex',
    max_completion_tokens: 5,
    messages: [{ role: 'user', content: 'ok' }],
  });
  record('service_tier: flex', 'pass', 'summaries can use the batch tier');
} catch (err) {
  record('service_tier: flex', 'warn', `${reason(err)} — drop it from summaries`);
}

// --------------------------------------------------------- reasoning_effort
// Sent on quiz generation ('medium').
try {
  await client.chat.completions.create({
    model: env.openaiModel,
    reasoning_effort: 'medium',
    max_completion_tokens: 5,
    messages: [{ role: 'user', content: 'ok' }],
  });
  record('reasoning_effort: medium', 'pass', 'quiz generation can keep it');
} catch (err) {
  record('reasoning_effort: medium', 'warn', `${reason(err)} — drop it from quiz generation`);
}

// --------------------------------------------------------------- embeddings
// The one that can cost a migration: the column is a fixed width.
let width = null;
try {
  const response = await client.embeddings.create({
    model: env.openaiEmbeddingModel,
    input: ['primary key'],
    dimensions: EMBEDDING_DIMENSIONS,
  });
  width = response.data[0].embedding.length;
  record(
    `embedding width is ${EMBEDDING_DIMENSIONS}`,
    width === EMBEDDING_DIMENSIONS ? 'pass' : 'fail',
    width === EMBEDDING_DIMENSIONS ? '' : `got ${width} — needs a migration and a full re-embed`,
  );
  record('embedding usage reported', response.usage ? 'pass' : 'warn', response.usage ? `${response.usage.total_tokens} tokens` : 'ingest would log zero');
} catch (err) {
  // A rejected `dimensions` parameter is common; retry without it, since the
  // native width may still be right.
  try {
    const response = await client.embeddings.create({
      model: env.openaiEmbeddingModel,
      input: ['primary key'],
    });
    width = response.data[0].embedding.length;
    record('embeddings without `dimensions`', 'warn', `endpoint rejected dimensions (${reason(err)})`);
    record(
      `embedding width is ${EMBEDDING_DIMENSIONS}`,
      width === EMBEDDING_DIMENSIONS ? 'pass' : 'fail',
      width === EMBEDDING_DIMENSIONS ? 'native width matches' : `got ${width} — needs a migration and a full re-embed`,
    );
  } catch (inner) {
    record('embeddings', 'fail', `${reason(inner)} — ingest and tutor retrieval are out`);
  }
}

// ------------------------------------------------------------------ verdict
const failed = results.filter((r) => r.status === 'fail');
const warned = results.filter((r) => r.status === 'warn');

console.log('\n' + '-'.repeat(60));
if (failed.length === 0) {
  console.log(`READY${warned.length ? ` (with ${warned.length} caveat${warned.length > 1 ? 's' : ''})` : ''}`);
  console.log('Every capability the AI layer depends on is supported.');
} else {
  console.log(`NOT READY — ${failed.length} blocking issue${failed.length > 1 ? 's' : ''}:`);
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exitCode = 1;
}
if (warned.length) {
  console.log('\nCaveats (work, but degraded or need a small code change):');
  for (const w of warned) console.log(`  - ${w.name}: ${w.detail}`);
}
console.log('');
