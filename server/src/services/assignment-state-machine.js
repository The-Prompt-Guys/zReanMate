import { ApiError } from '../middleware/errors.js';

export const ASSIGNMENT_TRANSITIONS = Object.freeze({
  not_started: Object.freeze(['in_progress', 'submitted', 'late']),
  in_progress: Object.freeze(['in_progress', 'submitted', 'late']),
  submitted: Object.freeze(['graded']),
  late: Object.freeze(['graded']),
  graded: Object.freeze([]),
});

export const assertAssignmentTransition = (from, to) => {
  if (!ASSIGNMENT_TRANSITIONS[from]?.includes(to)) {
    throw ApiError.conflict(`A submission cannot move from ${from} to ${to}`);
  }
};

