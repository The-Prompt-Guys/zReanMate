import { Router } from 'express';

import { summariesController } from '../controllers/summaries.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { chaptersBody, studyGuideBody, summarizeBody, summarySourceParams } from '../validation/summaries.schemas.js';

const router = Router();
router.use(...authenticated);
router.post('/:id/summarize', validateParams(summarySourceParams), validateBody(summarizeBody), summariesController.summarize);
router.post('/:id/chapters', validateParams(summarySourceParams), validateBody(chaptersBody), summariesController.chapters);
router.post('/:id/study-guide', validateParams(summarySourceParams), validateBody(studyGuideBody), summariesController.studyGuide);

export default router;
