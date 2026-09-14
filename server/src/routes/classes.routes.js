import { Router } from 'express';
import { classesController } from '../controllers/classes.controller.js';
import { authenticated } from '../middleware/guards.js';
import { requireRole } from '../middleware/requireAuth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { classKitParams, classParams, createClassBody, createLessonBody, joinClassBody, lessonItemParams } from '../validation/classes.schemas.js';

const router = Router();
router.use(...authenticated);
router.get('/', classesController.list);
router.post('/', requireRole('teacher'), validateBody(createClassBody), classesController.create);
router.post('/join', requireRole('student'), validateBody(joinClassBody), classesController.join);
router.get('/:classId', validateParams(classParams), classesController.show);
router.post('/:classId/lessons', requireRole('teacher'), validateParams(classParams), validateBody(createLessonBody), classesController.createLesson);
router.post('/:classId/kits/:kitId', requireRole('teacher'), validateParams(classKitParams), classesController.shareKit);
router.post('/lesson-items/:itemId/complete', requireRole('student'), validateParams(lessonItemParams), classesController.completeItem);
export default router;
