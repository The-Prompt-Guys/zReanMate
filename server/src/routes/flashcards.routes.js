import { Router } from 'express';
import { flashcardsController } from '../controllers/flashcards.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  dueFlashcardsQuery, flashcardParams, flashcardSourceParams,
  generateFlashcardsBody, reviewFlashcardBody,
} from '../validation/flashcards.schemas.js';

const router = Router();
router.use(...authenticated);
router.post('/sources/:id/flashcards', validateParams(flashcardSourceParams), validateBody(generateFlashcardsBody), flashcardsController.generate);
router.get('/flashcards/due', validateQuery(dueFlashcardsQuery), flashcardsController.due);
router.post('/flashcards/:id/review', validateParams(flashcardParams), validateBody(reviewFlashcardBody), flashcardsController.review);
export default router;

