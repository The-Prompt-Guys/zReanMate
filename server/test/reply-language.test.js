import test from 'node:test';
import assert from 'node:assert/strict';

import { detectRequestedReplyLanguage } from '../src/services/replyLanguage.service.js';

test('an English UI can request a Khmer explanation', () => {
  assert.equal(detectRequestedReplyLanguage('Please explain this in Khmer', 'en'), 'km');
});

test('Khmer script selects Khmer for the current reply', () => {
  assert.equal(detectRequestedReplyLanguage('សូមពន្យល់អំពី OOP', 'en'), 'km');
});

test('ordinary English questions keep the selected language', () => {
  assert.equal(detectRequestedReplyLanguage('What is OOP?', 'en'), 'en');
});