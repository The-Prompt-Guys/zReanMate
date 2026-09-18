import { plansService } from '../services/plans.service.js';
import { profileService } from '../services/profile.service.js';
import { tokenService } from '../services/token.service.js';

export const profileController = {
  async show(req, res) { res.json(await profileService.get(req.auth.userId)); },
  async update(req, res) { res.json(await profileService.update(req.auth.userId, req.body)); },
  async remove(req, res) {
    await profileService.deleteAccount(req.auth.userId);
    tokenService.clearAuthCookies(res);
    res.json({ deleted: true });
  },
  async limits(req, res) { res.json(await plansService.limits(req.auth.userId)); },
};

