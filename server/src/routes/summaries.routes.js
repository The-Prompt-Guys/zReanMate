import { Router } from 'express';

import { summariesController } from '../controllers/summaries.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { chaptersBody, summarizeBody, summarySourceParams } from '../validation/summaries.schemas.js';

const router = Router();
router.use(...authenticated);
router.post('/:id/summarize', validateParams(summarySourceParams), validateBody(summarizeBody), summariesController.summarize);
router.post('/:id/chapters', validateParams(summarySourceParams), validateBody(chaptersBody), summariesController.chapters);

export default router;
