import { Router } from 'express';

import { teacherController } from '../controllers/teacher.controller.js';
import { authenticated } from '../middleware/guards.js';
import { requireRole } from '../middleware/requireAuth.js';
import { handleUpload } from '../middleware/upload.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { createTeacherAssignmentBody, createTeacherQuizBody, teacherAssignmentParams, teacherAssignmentUpdateBody, teacherAssistantQuestionBody, teacherClassParams, teacherMaterialParams, teacherQuizDraftBody, updateTeacherClassBody } from '../validation/teacher.schemas.js';

const router = Router();

router.use(...authenticated, requireRole('teacher'));
router.get('/dashboard', teacherController.dashboard);
router.get('/assignments', teacherController.assignments);
router.get('/assignments/:assignmentId', validateParams(teacherAssignmentParams), teacherController.assignment);
router.patch('/assignments/:assignmentId', validateParams(teacherAssignmentParams), validateBody(teacherAssignmentUpdateBody), teacherController.updateAssignment);
router.delete('/assignments/:assignmentId', validateParams(teacherAssignmentParams), teacherController.deleteAssignment);
router.post('/assignments', validateBody(createTeacherAssignmentBody), teacherController.createAssignment);
router.post('/quizzes', validateBody(createTeacherQuizBody), teacherController.createQuiz);
router.post('/assignments/:assignmentId/attachment', validateParams(teacherAssignmentParams), handleUpload, teacherController.addAssignmentAttachment);
router.post('/assistant/ask', validateBody(teacherAssistantQuestionBody), teacherController.assistantAsk);
router.get('/assistant/history', teacherController.assistantHistory);
router.delete('/assistant/history', teacherController.clearAssistantHistory);
router.post('/assistant/quiz', validateBody(teacherQuizDraftBody), teacherController.assistantQuiz);
router.get('/classes/:classId/students', validateParams(teacherClassParams), teacherController.students);
router.get('/classes/:classId/materials', validateParams(teacherClassParams), teacherController.materials);
router.post('/classes/:classId/materials', validateParams(teacherClassParams), handleUpload, teacherController.addMaterial);
router.get('/classes/:classId/materials/:materialId/file', validateParams(teacherMaterialParams), teacherController.materialFile);
router.delete('/classes/:classId/materials/:materialId', validateParams(teacherMaterialParams), teacherController.removeMaterial);
router.patch('/classes/:classId', validateParams(teacherClassParams), validateBody(updateTeacherClassBody), teacherController.updateClass);

export default router;