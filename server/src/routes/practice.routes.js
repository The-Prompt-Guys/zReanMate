import { Router } from 'express';
import { practiceController } from '../controllers/practice.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { createPracticeBody, practiceAnswerBody, practiceSessionParams, practiceTopicsQuery, submitPracticeBody } from '../validation/practice.schemas.js';

const router = Router(); router.use(...authenticated);
router.get('/home', practiceController.home);
router.get('/progress', practiceController.progress);
router.get('/topics', validateQuery(practiceTopicsQuery), practiceController.topics);
router.post('/sessions', validateBody(createPracticeBody), practiceController.create);
router.get('/sessions/:sessionId', validateParams(practiceSessionParams), practiceController.get);
router.put('/sessions/:sessionId/answers', validateParams(practiceSessionParams), validateBody(practiceAnswerBody), practiceController.answer);
router.post('/sessions/:sessionId/submit', validateParams(practiceSessionParams), validateBody(submitPracticeBody), practiceController.submit);
export default router;
