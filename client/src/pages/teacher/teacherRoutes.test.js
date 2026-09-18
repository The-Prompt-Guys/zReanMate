import test from 'node:test';
import assert from 'node:assert/strict';

import { teacherRoutes, teacherTabRoutes } from './teacherRoutes.js';

test('teacher routes include the core screens', () => {
  const paths = teacherRoutes.map((route) => route.path);
  assert.ok(paths.includes('/teacher/classes'));
  assert.ok(paths.includes('/teacher/assignments'));
  assert.ok(paths.includes('/teacher/calendar'));
  assert.ok(paths.includes('/teacher/assignments/new'));
});

test('teacher tab routes expose the main app destinations', () => {
  const paths = teacherTabRoutes.map((route) => route.to);
  assert.deepEqual(paths, ['/teacher/classes', '/teacher/assignments', '/teacher/calendar', '/teacher/profile']);
});
