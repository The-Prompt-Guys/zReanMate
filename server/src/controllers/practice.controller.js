import { practiceService } from '../services/practice.service.js';

export const practiceController = {
  async topics(req, res) { res.json({ topics: await practiceService.topics(req.auth.userId, req.validatedQuery.q, req.validatedQuery.sourceId) }); },
  async create(req, res) { res.status(201).json(await practiceService.create(req.auth.userId, req.auth.plan, req.body)); },
  async get(req, res) { res.json(await practiceService.get(req.auth.userId, req.validatedParams.sessionId)); },
  async answer(req, res) { res.json(await practiceService.answer(req.auth.userId, req.validatedParams.sessionId, req.body)); },
  async submit(req, res) { res.json(await practiceService.submit(req.auth.userId, req.validatedParams.sessionId, req.body)); },
  async home(req, res) { res.json(await practiceService.home(req.auth.userId)); },
  async progress(req, res) { res.json(await practiceService.progress(req.auth.userId)); },
};
