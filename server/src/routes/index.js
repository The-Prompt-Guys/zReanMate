import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import kitRoutes from './kits.routes.js';
import folderRoutes from './folders.routes.js';
import summaryRoutes from './summaries.routes.js';
import chatRoutes from './chat.routes.js';
import quizRoutes from './quiz.routes.js';
import practiceRoutes from './practice.routes.js';
import flashcardRoutes from './flashcards.routes.js';
import classRoutes from './classes.routes.js';
import assignmentRoutes from './assignments.routes.js';
import profileRoutes from './profile.routes.js';
import { authController } from '../controllers/auth.controller.js';
import { authenticated } from '../middleware/guards.js';

const router = Router();

// Routes only wire things up — logic lives in services (CLAUDE.md, Hard rules).
router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/onboarding', onboardingRoutes);

router.use('/kits', kitRoutes);
router.use('/folders', folderRoutes);
router.use('/sources', summaryRoutes);
router.use('/chat', chatRoutes);
router.use(quizRoutes);
router.use('/practice', practiceRoutes);
router.use(flashcardRoutes);
router.use('/classes', classRoutes);
router.use(assignmentRoutes);
router.use(profileRoutes);

// Top-level alias; /api/auth/me serves the same handler.
router.get('/me', ...authenticated, authController.me);

export default router;
