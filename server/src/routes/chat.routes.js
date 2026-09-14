import { Router } from 'express';

import { chatController } from '../controllers/chat.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { chatKitParams, chatLanguageQuery, chatSessionParams, createChatSchema } from '../validation/chat.schemas.js';

const router = Router();
router.use(...authenticated);
router.get('/conversation/:kitId', validateParams(chatKitParams), validateQuery(chatLanguageQuery), chatController.conversation);
router.post('/', validateBody(createChatSchema), chatController.create);
router.post('/:sessionId/retry', validateParams(chatSessionParams), chatController.retry);
router.get('/:sessionId/stream', validateParams(chatSessionParams), chatController.stream);

export default router;
