import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

// Routes only wire things up — logic lives in services (CLAUDE.md, Hard rules).
router.use(healthRoutes);

// Feature routers mount here as each vertical slice lands:
//   router.use('/auth', authRoutes);
//   router.use('/kits', kitRoutes);

export default router;
