import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProcessingNavigation, isSourceReadyForStudy } from './processingFlow.js';

test('PDF upload handoff navigates to the processing sheet with the source id', () => {
  assert.deepEqual(buildProcessingNavigation('kit-123', 'src-456'), {
    pathname: '/kits/kit-123/add/processing',
    state: { kitId: 'kit-123', sourceId: 'src-456' },
  });
});

test('an upload handoff marks the upload step as already done', () => {
  assert.deepEqual(buildProcessingNavigation('kit-123', 'src-456', { uploaded: true }), {
    pathname: '/kits/kit-123/add/processing',
    state: { kitId: 'kit-123', sourceId: 'src-456', uploaded: true },
  });
});

test('source is only considered done when the backend marks it ready', () => {
  assert.equal(isSourceReadyForStudy({ status: 'ready' }), true);
  assert.equal(isSourceReadyForStudy({ status: 'processing', stage: 'ready' }), false);
  assert.equal(isSourceReadyForStudy({ status: 'pending' }), false);
});

test('a photo upload is flagged so the processing steps do not call a document a photo', () => {
  assert.deepEqual(buildProcessingNavigation('kit-123', 'src-456', { uploaded: true, photo: true }), {
    pathname: '/kits/kit-123/add/processing',
    state: { kitId: 'kit-123', sourceId: 'src-456', uploaded: true, photo: true },
  });
});

test('a document upload carries no photo flag, so the steps read as a file', () => {
  const { state } = buildProcessingNavigation('kit-123', 'src-456', { uploaded: true, photo: false });
  assert.equal('photo' in state, false);
});
