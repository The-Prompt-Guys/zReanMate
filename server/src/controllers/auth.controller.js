import { authService } from '../services/auth.service.js';

/** Routes wire; controllers translate HTTP; services hold the logic. */
export const authController = {
  async register(req, res) {
    const user = await authService.register(req.body, { req, res });
    res.status(201).json({ user });
  },

  async login(req, res) {
    const user = await authService.login(req.body, { req, res });
    // A correct password shouldn't count toward the lockout window.
    req.clearRateLimit?.();
    res.json({ user });
  },

  async logout(req, res) {
    await authService.logout({ req, res });
    res.status(204).end();
  },

  async refresh(req, res) {
    const user = await authService.refresh({ req, res });
    res.json({ user });
  },

  async me(req, res) {
    res.json(await authService.me(req.auth.userId));
  },
};
