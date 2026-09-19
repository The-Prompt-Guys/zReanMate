import test from 'node:test';
import assert from 'node:assert/strict';

import { summaryCacheKey } from '../src/services/summaries.service.js';

/**
 * The bug these tests exist for: `ai_generation_cache` was keyed by source,
 * method and params alone, so a row written by the mock provider occupied the
 * slot the real provider would have used. A student with a live OPENAI_API_KEY
 * kept being served the mock's three canned database questions about a document
 * that had nothing to do with databases, because the cache said 'ready'.
 */

const base = { sourceId: '11111111-1111-1111-1111-111111111111', method: 'generateQuiz' };

test('the provider is part of the cache identity', () => {
  const mock = summaryCacheKey({ ...base, params: { language: 'km' }, provider: 'mock' });
  const real = summaryCacheKey({ ...base, params: { language: 'km' }, provider: 'openai' });

  assert.equal(mock.provider, 'mock');
  assert.equal(real.provider, 'openai');
  // Same request, different providers -> different rows under
  // UNIQUE (source_id, method, params_hash, provider).
  assert.notEqual(
    `${mock.paramsHash}:${mock.provider}`,
    `${real.paramsHash}:${real.provider}`,
  );
});

test('the provider does not disturb the params hash', () => {
  // The hash covers generation params only; the provider is its own column, so
  // it stays readable in SQL rather than being buried in a digest.
  const mock = summaryCacheKey({ ...base, params: { language: 'km' }, provider: 'mock' });
  const real = summaryCacheKey({ ...base, params: { language: 'km' }, provider: 'openai' });
  assert.equal(mock.paramsHash, real.paramsHash);
});

test('params still key the row independently of the provider', () => {
  const km = summaryCacheKey({ ...base, params: { language: 'km' }, provider: 'openai' });
  const en = summaryCacheKey({ ...base, params: { language: 'en' }, provider: 'openai' });
  assert.notEqual(km.paramsHash, en.paramsHash);
});

test('params are canonicalised, so key order cannot split a cache row', () => {
  const one = summaryCacheKey({ ...base, params: { language: 'km', count: 10 }, provider: 'openai' });
  const two = summaryCacheKey({ ...base, params: { count: 10, language: 'km' }, provider: 'openai' });
  assert.equal(one.paramsHash, two.paramsHash);
});
