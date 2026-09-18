import { onboardingService } from '../services/onboarding.service.js';
import { tokenService } from '../services/token.service.js';

export const onboardingController = {
  async setRole(req, res) {
    const user = await onboardingService.setRole(req.auth.userId, req.body.role);
    tokenService.setAccessCookie(res, tokenService.signAccessToken(user));
    res.json({ user });
  },

  async submitSurvey(req, res) {
    const { response, user } = await onboardingService.submitSurvey(req.auth.userId, req.body);
    res.json({
      survey: {
        answers: response.answers,
        skipped: response.skipped,
        completedAt: response.completed_at,
      },
      ...(user && { user }),
    });
  },

  async getSurvey(req, res) {
    const response = await onboardingService.getSurvey(req.auth.userId);
    res.json({
      survey: {
        answers: response?.answers ?? {},
        skipped: response?.skipped ?? false,
        completedAt: response?.completed_at ?? null,
      },
    });
  },
};
