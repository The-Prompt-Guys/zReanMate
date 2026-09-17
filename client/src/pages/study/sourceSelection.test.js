import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveStudySource } from './sourceSelection.js';

test('prefers the explicitly selected source when a kit has multiple PDFs', () => {
  const files = [
    { id: 'pdf-1', status: 'ready', name: 'Alpha.pdf' },
    { id: 'pdf-2', status: 'ready', name: 'Beta.pdf' },
  ];

  assert.equal(resolveStudySource(files, 'pdf-2')?.id, 'pdf-2');
});

test('falls back to the first ready source when no source is explicitly selected', () => {
  const files = [
    { id: 'pdf-1', status: 'ready', name: 'Alpha.pdf' },
    { id: 'pdf-2', status: 'ready', name: 'Beta.pdf' },
  ];

  assert.equal(resolveStudySource(files, null)?.id, 'pdf-1');
});

test('does not pick a pending source as the active study source before it is ready', () => {
  const files = [
    { id: 'pdf-1', status: 'pending', name: 'Alpha.pdf' },
    { id: 'pdf-2', status: 'pending', name: 'Beta.pdf' },
  ];

  assert.equal(resolveStudySource(files, null), null);
});

test('a selected source that is still processing does not fall back to a ready sibling', () => {
  const files = [
    { id: 'pdf-1', status: 'ready', name: 'Alpha.pdf' },
    { id: 'pdf-2', status: 'processing', name: 'cost-analyst1.pdf' },
  ];

  assert.equal(resolveStudySource(files, 'pdf-2')?.id, 'pdf-2');
  assert.equal(resolveStudySource(files, 'pdf-2')?.status, 'processing');
});

test('a selected source that is not in the kit resolves to nothing rather than another file', () => {
  const files = [
    { id: 'pdf-1', status: 'ready', name: 'Alpha.pdf' },
    { id: 'pdf-2', status: 'ready', name: 'Beta.pdf' },
  ];

  // Deleted file, stale link, wrong kit — any of these used to silently study
  // Alpha.pdf under the name of the file the student had actually picked.
  assert.equal(resolveStudySource(files, 'pdf-gone'), null);
});
