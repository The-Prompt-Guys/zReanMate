import { randomBytes } from 'node:crypto';

import { classesDb } from '../db/classes.db.js';
import { ApiError } from '../middleware/errors.js';

const classApi = (row) => ({
  id: row.id, title: row.title, description: row.description, subject: row.subject,
  teacher: row.teacher_name, teacherId: row.teacher_id, joinCode: row.join_code,
  weeks: row.week_count, lessonCount: row.lesson_count, lessonsDone: row.lessons_done,
  status: row.status,
});
const groupByWeek = (rows) => Object.values(rows.reduce((groups, row) => {
  const week = row.week_number;
  groups[week] ??= { week, lessons: [] };
  groups[week].lessons.push({
    id: row.id, title: row.title, description: row.description, kind: row.kind,
    position: row.position, status: row.progress_status, done: row.completed_items,
    total: row.item_count, items: row.items,
  });
  return groups;
}, {}));

export const classesService = {
  async list(userId) { return { classes: (await classesDb.list(userId)).map(classApi) }; },

  async get(userId, classId) {
    const klass = await classesDb.detail(userId, classId);
    if (!klass) throw ApiError.notFound('That class does not exist');
    const [lessons, materials, quizzes, assignments] = await Promise.all([
      classesDb.lessons(userId, classId), classesDb.materials(userId, classId),
      classesDb.quizzes(userId, classId), classesDb.assignments(userId, classId),
    ]);
    return {
      class: classApi(klass), weeks: groupByWeek(lessons),
      materials: materials.map((row) => ({ id: row.id, title: row.title, mimeType: row.mime_type,
        byteSize: Number(row.byte_size ?? 0), week: row.week_number })),
      quizzes: quizzes.map((row) => ({ id: row.id, title: row.title,
        questionCount: row.question_count, status: row.status, week: row.week_number,
        kitId: row.study_kit_id })),
      assignments: assignments.map((row) => ({ id: row.id, title: row.title,
        dueAt: row.due_at, status: row.status })),
    };
  },

  async create(teacherId, input) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const row = await classesDb.create({ teacherId, ...input,
          joinCode: randomBytes(4).toString('hex').slice(0, 6).toUpperCase() });
        return { class: classApi({ ...row, teacher_name: null, lesson_count: 0, lessons_done: 0 }) };
      } catch (error) {
        if (error.code !== '23505' || attempt === 4) throw error;
      }
    }
    throw ApiError.conflict('Could not allocate a class code');
  },

  async join(userId, code) {
    const joined = await classesDb.join({ userId, code });
    if (!joined) throw ApiError.notFound('That class code is not valid');
    return this.get(userId, joined.class_id);
  },

  async createLesson(teacherId, classId, input) {
    const lesson = await classesDb.createLesson({ teacherId, classId, lesson: input, items: input.items });
    if (!lesson) throw ApiError.notFound('That class does not exist or the week is outside its schedule');
    return { lesson: { id: lesson.id, classId, weekNumber: lesson.week_number,
      position: lesson.position, title: lesson.title, kind: lesson.kind, items: input.items } };
  },

  async shareKit(teacherId, classId, kitId) {
    const kit = await classesDb.shareKit({ teacherId, classId, kitId });
    if (!kit) throw ApiError.notFound('That class or study kit does not exist');
    return { kit: { id: kit.id, classId: kit.class_id } };
  },

  async completeItem(userId, itemId) {
    const progress = await classesDb.completeItem({ userId, itemId });
    if (!progress) throw ApiError.notFound('That lesson item does not exist');
    return { progress: { lessonId: progress.lesson_id, status: progress.status,
      startedAt: progress.started_at, completedAt: progress.completed_at } };
  },
};
