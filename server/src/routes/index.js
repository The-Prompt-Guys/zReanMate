import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import { authController } from '../controllers/auth.controller.js';
import { authenticated } from '../middleware/guards.js';

const router = Router();

// Routes only wire things up — logic lives in services (CLAUDE.md, Hard rules).
router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/onboarding', onboardingRoutes);

// Top-level alias; /api/auth/me serves the same handler.
router.get('/me', ...authenticated, authController.me);

// Feature routers mount here as each vertical slice lands:
//   router.use('/kits', kitRoutes);

export default router;
