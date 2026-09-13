import { healthService } from '../services/health.service.js';

export const healthController = {
  async check(req, res) {
    const health = await healthService.check();
    res.status(health.database === 'up' ? 200 : 503).json(health);
  },
};
