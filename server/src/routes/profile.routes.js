import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody } from '../middleware/validate.js';
import { updateProfileBody } from '../validation/profile.schemas.js';
const router = Router();
router.use(...authenticated);
router.get('/profile', profileController.show);
router.patch('/profile', validateBody(updateProfileBody), profileController.update);
router.get('/me/limits', profileController.limits);
export default router;

