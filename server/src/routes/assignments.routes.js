import { Router } from 'express';
import { assignmentsController } from '../controllers/assignments.controller.js';
import { authenticated } from '../middleware/guards.js';
import { requireRole } from '../middleware/requireAuth.js';
import { handleUpload } from '../middleware/upload.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { assignmentParams, createAssignmentBody, gradeParams, gradeSubmissionBody, lessonAssignmentParams, saveSubmissionBody } from '../validation/assignments.schemas.js';

const router = Router();
router.use(...authenticated);
router.post('/lessons/:lessonId/assignments', requireRole('teacher'), validateParams(lessonAssignmentParams), validateBody(createAssignmentBody), assignmentsController.create);
router.get('/assignments/:assignmentId', validateParams(assignmentParams), assignmentsController.show);
router.get('/assignments/:assignmentId/questions', validateParams(assignmentParams), assignmentsController.questions);
router.put('/assignments/:assignmentId/submission', requireRole('student'), validateParams(assignmentParams), validateBody(saveSubmissionBody), assignmentsController.save);
router.post('/assignments/:assignmentId/submission/files', requireRole('student'), validateParams(assignmentParams), handleUpload, assignmentsController.upload);
router.get('/assignments/:assignmentId/submissions', requireRole('teacher'), validateParams(assignmentParams), assignmentsController.submissions);
router.patch('/assignments/:assignmentId/submissions/:submissionId', requireRole('teacher'), validateParams(gradeParams), validateBody(gradeSubmissionBody), assignmentsController.grade);
export default router;

