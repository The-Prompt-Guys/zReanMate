import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import kitRoutes from './kits.routes.js';
import folderRoutes from './folders.routes.js';
import { authController } from '../controllers/auth.controller.js';
import { authenticated } from '../middleware/guards.js';

const router = Router();

// Routes only wire things up — logic lives in services (CLAUDE.md, Hard rules).
router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/onboarding', onboardingRoutes);

router.use('/kits', kitRoutes);
router.use('/folders', folderRoutes);

// Top-level alias; /api/auth/me serves the same handler.
router.get('/me', ...authenticated, authController.me);

export default router;
