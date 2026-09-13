import { Router } from 'express';

import { onboardingController } from '../controllers/onboarding.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody } from '../middleware/validate.js';
import { roleSchema, surveySchema } from '../validation/auth.schemas.js';

const router = Router();

// Spreading `authenticated` rather than naming requireAuth is what lets
// requireVerified be added later in one place — see middleware/guards.js.
router.post('/role', ...authenticated, validateBody(roleSchema), onboardingController.setRole);

router.post(
  '/survey',
  ...authenticated,
  validateBody(surveySchema),
  onboardingController.submitSurvey,
);

router.get('/survey', ...authenticated, onboardingController.getSurvey);

export default router;
