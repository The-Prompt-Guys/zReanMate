import { Router } from 'express';
import { quizController } from '../controllers/quiz.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { answerBody, attemptIdParams, generateQuizBody, quizIdParams, quizSourceParams } from '../validation/quiz.schemas.js';

const router = Router();
router.use(...authenticated);
router.post('/sources/:id/quiz', validateParams(quizSourceParams), validateBody(generateQuizBody), quizController.generate);
router.post('/quizzes/:quizId/attempts', validateParams(quizIdParams), quizController.start);
router.get('/attempts/:attemptId', validateParams(attemptIdParams), quizController.attempt);
router.put('/attempts/:attemptId/answers', validateParams(attemptIdParams), validateBody(answerBody), quizController.answer);
router.post('/attempts/:attemptId/submit', validateParams(attemptIdParams), quizController.submit);
export default router;
