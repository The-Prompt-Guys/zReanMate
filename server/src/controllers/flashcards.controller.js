import { flashcardsService } from '../services/flashcards.service.js';

export const flashcardsController = {
  async generate(req, res) {
    const result = await flashcardsService.generate(req.auth.userId, req.auth.plan, req.validatedParams.id, req.body);
    res.status(result.status === 'ready' ? 200 : 202).json(result);
  },
  async due(req, res) { res.json(await flashcardsService.due(req.auth.userId, req.validatedQuery)); },
  async review(req, res) {
    res.json(await flashcardsService.review(req.auth.userId, req.validatedParams.id, req.body.quality));
  },
};

