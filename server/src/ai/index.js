import { env } from '../config/env.js';
import { AI_METHODS } from './types.js';
import { createMockProvider } from './mock.js';
import { createOpenAIProvider } from './openai.js';

/**
 * The only entry point to AI for the whole server.
 *
 * Controllers and routes must never import ./openai.js or ./mock.js directly
 * (CLAUDE.md, AI layer) — call getAI() and use what it returns, so the mock
 * fallback holds everywhere.
 */

let provider = null;
let warned = false;

const warnOnce = (message) => {
  if (warned) return;
  console.warn(`[ai] ${message}`);
  warned = true;
};

/** Catches a provider that drifts from AIProvider before anything calls it. */
const assertConformsToInterface = (candidate) => {
  const missing = AI_METHODS.filter((method) => typeof candidate[method] !== 'function');
  if (missing.length > 0) {
    throw new Error(
      `AI provider "${candidate.name}" is missing: ${missing.join(', ')}. ` +
        'Every provider must implement the full AIProvider interface (see ./types.js).',
    );
  }
  return candidate;
};

const buildProvider = () => {
  if (!env.openaiApiKey) {
    warnOnce(
      'OPENAI_API_KEY is not set — falling back to the mock provider. ' +
        'Responses are canned; the shapes are real.',
    );
    return assertConformsToInterface(createMockProvider());
  }

  try {
    const real = assertConformsToInterface(createOpenAIProvider());
    // The endpoint is logged, not just the model: an OpenAI-compatible gateway
    // receives the same study material as api.openai.com would, and which host
    // that is should never be something you have to read the env to discover.
    const endpoint = env.openaiBaseUrl ?? 'api.openai.com (default)';
    console.log(
      `[ai] using OpenAI-compatible endpoint ${endpoint} ` +
        `(${env.openaiModel}, embeddings ${env.openaiEmbeddingModel})`,
    );
    return real;
  } catch (err) {
    // A bad key or config shouldn't take the server down — degrade and say so.
    warnOnce(`OpenAI provider unavailable (${err.message}) — using the mock provider`);
    return assertConformsToInterface(createMockProvider());
  }
};

/** Returns the active provider, building it once per process. */
export const getAI = () => {
  provider ??= buildProvider();
  return provider;
};

/** True when the mock is in play — use it to gate cost controls and rate limits. */
export const isMockAI = () => getAI().name === 'mock';

/** Test seam: forces the next getAI() to rebuild. */
export const resetAI = () => {
  provider = null;
  warned = false;
};

export { EMBEDDING_DIMENSIONS, AI_METHODS } from './types.js';
