import { summariesService } from '../services/summaries.service.js';
import { studyGuideService } from '../services/studyGuide.service.js';

export const summariesController = {
  async summarize(req, res) {
    const result = await summariesService.summarize(req.auth.userId, req.validatedParams.id, req.body);
    res.status(result.status === 'ready' ? 200 : 202).json(result);
  },

  async chapters(req, res) {
    const result = await summariesService.chapters(req.auth.userId, req.validatedParams.id, req.body);
    return res.status(result.status === 'ready' ? 200 : 202).json(result);
  },

  // 202 while modules are still being written — the screen polls and shows the
  // ones that are ready as they land.
  async studyGuide(req, res) {
    const result = await studyGuideService.generate(req.auth.userId, req.validatedParams.id, req.body);
    return res.status(result.status === 'ready' ? 200 : 202).json(result);
  },
};
