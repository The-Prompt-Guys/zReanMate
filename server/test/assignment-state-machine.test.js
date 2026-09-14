import assert from 'node:assert/strict';
import test from 'node:test';

import { assertAssignmentTransition } from '../src/services/assignment-state-machine.js';

test('draft work can progress or submit on time or late', () => {
  for (const from of ['not_started', 'in_progress']) {
    for (const to of ['in_progress', 'submitted', 'late']) {
      assert.doesNotThrow(() => assertAssignmentTransition(from, to));
    }
  }
});

test('only a teacher grade follows a submitted or late state', () => {
  assert.doesNotThrow(() => assertAssignmentTransition('submitted', 'graded'));
  assert.doesNotThrow(() => assertAssignmentTransition('late', 'graded'));
  assert.throws(() => assertAssignmentTransition('submitted', 'in_progress'));
  assert.throws(() => assertAssignmentTransition('late', 'submitted'));
});

test('graded is terminal', () => {
  for (const state of ['not_started', 'in_progress', 'submitted', 'late', 'graded']) {
    assert.throws(() => assertAssignmentTransition('graded', state));
  }
});

