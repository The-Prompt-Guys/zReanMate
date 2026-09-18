import { teacherDb } from '../db/teacher.db.js';
import { ApiError } from '../middleware/errors.js';
import { absoluteUploadPath, removeUploadedFile, relativeUploadPath, verifyUploadedFile } from '../middleware/upload.js';
import { getAI } from '../ai/index.js';

const number = (value) => Number(value ?? 0);

export const teacherService = {
  async dashboard(teacherId) {
    const data = await teacherDb.dashboard(teacherId);
    return {
      summary: {
        activeClasses: number(data.summary.active_classes),
        totalStudents: number(data.summary.total_students),
        pendingReviews: number(data.summary.pending_reviews),
        returnedSubmissions: number(data.summary.returned_submissions),
      },
      classes: data.classes.map((row) => ({
        id: row.id,
        title: row.title,
        subject: row.subject,
        coverUrl: row.cover_image_path ? `/api/classes/${row.id}/cover` : null,
        joinCode: row.join_code,
        studentCount: number(row.student_count),
        lessonCount: number(row.lesson_count),
        completedLessons: number(row.completed_lessons),
      })),
      assignments: data.assignments.map((row) => ({
        id: row.id,
        title: row.title,
        classId: row.class_id,
        className: row.class_name,
        dueAt: row.due_at,
        submissionCount: number(row.submission_count),
        pendingCount: number(row.pending_count),
        gradedCount: number(row.graded_count),
        studentCount: number(row.student_count),
      })),
    };
  },

  async updateClass(teacherId, classId, patch) {
    const row = await teacherDb.updateClass({ teacherId, classId, patch });
    if (!row) throw ApiError.notFound('That class does not exist or is not yours');
    return { class: {
      id: row.id, title: row.title, description: row.description, subject: row.subject,
      joinCode: row.join_code, weekCount: row.week_count, coverColor: row.cover_color, status: row.status,
    } };
  },

  async students(teacherId, classId) {
    const rows = await teacherDb.students({ teacherId, classId });
    return { students: rows.map((row) => ({
      id: row.id, name: row.name, joinedAt: row.joined_at,
      lessonCount: number(row.lesson_count), completedLessons: number(row.completed_lessons),
      assignmentCount: number(row.assignment_count), submittedAssignments: number(row.submitted_assignments),
      gradedAssignments: number(row.graded_assignments), averageScore: Number(row.average_score ?? 0),
    })) };
  },

  async assignments(teacherId) {
    const rows = await teacherDb.assignments(teacherId);
    return { assignments: rows.map((row) => ({
      id: row.id, classId: row.class_id, className: row.class_name, title: row.title,
      description: row.description, type: row.assignment_type, status: row.status,
      dueAt: row.due_at, points: row.points, questionCount: row.question_count,
      studentCount: number(row.student_count), submissionCount: number(row.submission_count),
      pendingCount: number(row.pending_count), gradedCount: number(row.graded_count),
    })) };
  },

  async assignment(teacherId, assignmentId) {
    const row = await teacherDb.assignment({ teacherId, assignmentId });
    if (!row) throw ApiError.notFound('That assignment does not exist or is not yours');
    return { assignment: {
      id: row.id, classId: row.class_id, quizId: row.quiz_id, className: row.class_name,
      title: row.title, description: row.description, instructions: row.instructions ?? [],
      dueAt: row.due_at, points: Number(row.points ?? 0), questionCount: row.question_count,
      type: row.assignment_type, allowFileUpload: row.allow_file_upload, status: row.status,
      materials: row.materials ?? [],
    } };
  },

  async updateAssignment(teacherId, assignmentId, input) {
    const row = await teacherDb.updateAssignment({ teacherId, assignmentId, input });
    if (!row) throw ApiError.notFound('That assignment does not exist or is not yours');
    return { assignment: {
      id: row.id, classId: row.class_id, title: row.title, description: row.description,
      instructions: row.instructions ?? [], dueAt: row.due_at, points: Number(row.points ?? 0),
      type: row.assignment_type, status: row.status,
    } };
  },

  async deleteAssignment(teacherId, assignmentId) {
    const result = await teacherDb.deleteAssignment({ teacherId, assignmentId });
    if (!result) throw ApiError.notFound('That assignment does not exist or is not yours');
    for (const material of result.materials ?? []) {
      if (material.storage_path) {
        await removeUploadedFile(absoluteUploadPath(material.storage_path)).catch(() => {});
      }
    }
    return { deleted: true, assignmentId };
  },

  async createAssignment(teacherId, input) {
    const row = await teacherDb.createAssignment({ teacherId, input });
    if (!row) throw ApiError.notFound('That class or quiz does not exist, or it is not yours');
    return { assignment: {
      id: row.id, classId: row.class_id, lessonId: row.lesson_id, quizId: row.quiz_id,
      title: row.title, description: row.description, instructions: row.instructions,
      dueAt: row.due_at, points: row.points, questionCount: row.question_count,
      type: row.assignment_type, status: row.status, allowFileUpload: row.allow_file_upload,
    } };
  },

  async createQuiz(teacherId, input) {
    const context = await teacherDb.classContext({ teacherId, classId: input.classId });
    if (!context.length) throw ApiError.notFound('That class does not exist or is not yours');
    const text = context
      .filter((row) => row.content_md || row.item_content)
      .map((row) => [row.lesson_title, row.content_md, row.item_title, row.item_content].filter(Boolean).join('\n'))
      .join('\n\n') || `Class: ${context[0].class_title}`;
    const generated = input.questions?.length ? { title: input.title, questions: input.questions } : await getAI().generateQuiz({
      text,
      title: input.title,
      language: input.language,
      count: input.count,
    });
    if (!generated?.questions?.length) throw ApiError.badRequest('The quiz could not be generated');
    const result = await teacherDb.createQuiz({ teacherId, input, quiz: generated });
    if (!result) throw ApiError.notFound('That class does not exist or is not yours');
    return { quiz: { id: result.quiz.id, title: result.quiz.title, questionCount: result.quiz.question_count }, assignment: result.assignment };
  },

  async addAssignmentAttachment(teacherId, assignmentId, file) {
    if (!file) throw ApiError.badRequest('Choose one attachment file');
    const verified = await verifyUploadedFile(file);
    const savedFile = { ...file, ...verified, storagePath: relativeUploadPath(file.path) };
    try {
      const row = await teacherDb.addAssignmentAttachment({ teacherId, assignmentId, file: savedFile });
      if (!row) throw ApiError.notFound('That assignment does not exist or is not yours');
      return { material: {
        id: row.id,
        assignmentId: row.assignment_id,
        title: row.title,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        byteSize: Number(row.byte_size ?? 0),
      } };
    } catch (error) {
      await removeUploadedFile(file.path).catch(() => {});
      throw error;
    }
  },

  async materials(teacherId, classId) {
    const rows = await teacherDb.materials({ teacherId, classId });
    return { materials: rows.map((row) => ({
      id: row.id, title: row.title, originalFilename: row.original_filename,
      mimeType: row.mime_type, byteSize: Number(row.byte_size ?? 0), lessonId: row.lesson_id,
      week: Number(row.week_number ?? 1),
      createdAt: row.created_at,
    })) };
  },

  async materialFile(teacherId, classId, materialId) {
    const row = await teacherDb.materialFile({ teacherId, classId, materialId });
    if (!row) throw ApiError.notFound('That material does not exist or is not yours');
    return {
      path: absoluteUploadPath(row.storage_path),
      mimeType: row.mime_type,
      originalFilename: row.original_filename,
    };
  },

  async addMaterial(teacherId, classId, file, title, weekNumber = 1) {
    if (!file) throw ApiError.badRequest('Choose one material file');
    const verified = await verifyUploadedFile(file);
    const savedFile = { ...file, ...verified, storagePath: relativeUploadPath(file.path) };
    try {
      const row = await teacherDb.addMaterial({
        teacherId, classId, title: title?.trim() || file.originalname,
        weekNumber: Number(weekNumber) || 1, file: savedFile,
      });
      if (!row) throw ApiError.notFound('That class does not exist or is not yours');
      return { material: {
        id: row.id, title: row.title, originalFilename: row.original_filename,
        mimeType: row.mime_type, byteSize: Number(row.byte_size ?? 0), createdAt: row.created_at,
        week: Number(row.week_number ?? weekNumber ?? 1),
      } };
    } catch (error) {
      await removeUploadedFile(file.path).catch(() => {});
      throw error;
    }
  },

  async removeMaterial(teacherId, classId, materialId) {
    const row = await teacherDb.removeMaterial({ teacherId, classId, materialId });
    if (!row) throw ApiError.notFound('That material does not exist or is not yours');
    await removeUploadedFile(absoluteUploadPath(row.storage_path));
    return { deleted: true, materialId };
  },
};