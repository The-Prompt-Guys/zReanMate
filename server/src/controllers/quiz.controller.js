import { quizService } from '../services/quiz.service.js';

export const quizController = {
  async generate(req, res) {
    const result = await quizService.generate(req.auth.userId, req.auth.plan, req.validatedParams.id, req.body);
    res.status(result.status === 'ready' ? 200 : 202).json(result);
  },
  async start(req, res) { res.status(201).json(await quizService.start(req.auth.userId, req.validatedParams.quizId)); },
  async attempt(req, res) { res.json(await quizService.getAttempt(req.auth.userId, req.validatedParams.attemptId)); },
  async answer(req, res) { res.json(await quizService.answer(req.auth.userId, req.validatedParams.attemptId, req.body)); },
  async submit(req, res) { res.json(await quizService.submit(req.auth.userId, req.validatedParams.attemptId)); },
};
