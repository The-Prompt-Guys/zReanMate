import { assignmentsDb } from '../db/assignments.db.js';
import { ApiError } from '../middleware/errors.js';
import { relativeUploadPath, removeUploadedFile, verifyUploadedFile } from '../middleware/upload.js';
import { assertAssignmentTransition } from './assignment-state-machine.js';

const submissionApi = (row) => ({
  id: row.submission_id ?? row.id ?? null,
  status: row.submission_status ?? row.status ?? 'not_started',
  completed: row.completed_questions ?? 0,
  answers: row.answers ?? {}, files: row.files ?? [], isLate: Boolean(row.is_late),
  submittedAt: row.submitted_at ?? null, gradedAt: row.graded_at ?? null,
  score: row.score ?? null, feedback: row.feedback ?? null,
});

const assignmentApi = (row) => ({
  id: row.id, classId: row.class_id, lessonId: row.lesson_id, quizId: row.quiz_id,
  title: row.title, className: row.class_name, overview: row.description,
  instructions: row.instructions ?? [], dueAt: row.due_at, points: row.points,
  questionCount: row.question_count, type: row.assignment_type,
  allowFileUpload: row.allow_file_upload, materials: row.materials ?? [],
});

export const assignmentsService = {
  async create(teacherId, lessonId, input) {
    const row = await assignmentsDb.create({ teacherId, lessonId, input });
    if (!row) throw ApiError.notFound('That lesson or quiz does not exist');
    return { assignment: assignmentApi(row) };
  },

  async get(userId, assignmentId) {
    const row = await assignmentsDb.detail({ userId, assignmentId });
    if (!row) throw ApiError.notFound('That assignment does not exist');
    return { assignment: assignmentApi(row), submission: submissionApi(row) };
  },

  async questions(userId, assignmentId) {
    const rows = await assignmentsDb.questions({ userId, assignmentId });
    return { questions: rows.map((row) => ({ id: row.id, position: row.position,
      prompt: row.prompt, options: row.options })) };
  },

  async saveQuiz(userId, assignmentId, input) {
    const result = await assignmentsDb.saveQuiz({ userId, assignmentId, ...input });
    if (!result) throw ApiError.notFound('That quiz assignment does not exist');
    if (result.invalidAnswers) throw ApiError.badRequest('One or more answers do not belong to this assignment');
    if (result.incomplete) throw ApiError.conflict('Answer every question before submitting');
    if (result.terminal) throw ApiError.conflict('That assignment has already been submitted');
    const next = result.row.status;
    assertAssignmentTransition(result.row.submitted_at ? 'in_progress' : 'not_started', next);
    return { submission: submissionApi(result.row) };
  },

  async upload(userId, assignmentId, file) {
    if (!file) throw ApiError.badRequest('Choose one file to submit');
    const verified = await verifyUploadedFile(file);
    const savedFile = { ...file, ...verified, storagePath: relativeUploadPath(file.path) };
    try {
      const result = await assignmentsDb.addFile({ userId, assignmentId, file: savedFile });
      if (!result) throw ApiError.notFound('That file assignment does not exist');
      if (result.terminal) throw ApiError.conflict('That assignment has already been submitted');
      assertAssignmentTransition('not_started', result.row.status);
      return { submission: submissionApi(result.row), file: {
        id: result.file.id, name: result.file.original_filename,
        size: Number(result.file.byte_size), uploadedAt: result.file.uploaded_at,
      } };
    } catch (error) {
      await removeUploadedFile(file.path).catch(() => {});
      throw error;
    }
  },

  async submissions(teacherId, assignmentId) {
    const rows = await assignmentsDb.submissions({ teacherId, assignmentId });
    return { submissions: rows.map((row) => ({ ...submissionApi(row),
      studentId: row.user_id, studentName: row.student_name, fileCount: row.file_count })) };
  },

  async grade(teacherId, assignmentId, submissionId, input) {
    const row = await assignmentsDb.grade({ teacherId, assignmentId, submissionId, ...input });
    if (!row) throw ApiError.conflict('Only a submitted assignment can be graded');
    return { submission: submissionApi(row) };
  },
};

