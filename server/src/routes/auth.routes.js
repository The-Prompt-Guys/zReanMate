import { Router } from 'express';

import { authController } from '../controllers/auth.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody } from '../middleware/validate.js';
import {
  loginRateLimitByIdentifier,
  loginRateLimitByIp,
  registerRateLimitByIp,
} from '../middleware/rateLimit.js';
import { loginSchema, registerSchema } from '../validation/auth.schemas.js';

const router = Router();

// Order matters: zod runs first so the rate limiter keys off a trimmed,
// lower-cased identifier rather than whatever arrived on the wire.
router.post(
  '/register',
  validateBody(registerSchema),
  registerRateLimitByIp,
  authController.register,
);

router.post(
  '/login',
  validateBody(loginSchema),
  loginRateLimitByIdentifier,
  loginRateLimitByIp,
  authController.login,
);

// Unauthenticated on purpose: the access token is usually expired by the time
// this is called. The refresh cookie is the credential.
router.post('/refresh', authController.refresh);

// Also unauthenticated — logging out with a dead access token must still clear
// the cookies and revoke the session.
router.post('/logout', authController.logout);

router.get('/me', ...authenticated, authController.me);

export default router;
