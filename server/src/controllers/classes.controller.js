import { classesService } from '../services/classes.service.js';

export const classesController = {
  async list(req, res) { res.json(await classesService.list(req.auth.userId)); },
  async show(req, res) { res.json(await classesService.get(req.auth.userId, req.validatedParams.classId)); },
  async create(req, res) { res.status(201).json(await classesService.create(req.auth.userId, req.body)); },
  async join(req, res) { res.status(201).json(await classesService.join(req.auth.userId, req.body.code)); },
  async createLesson(req, res) { res.status(201).json(await classesService.createLesson(req.auth.userId, req.validatedParams.classId, req.body)); },
  async shareKit(req, res) { res.json(await classesService.shareKit(req.auth.userId, req.validatedParams.classId, req.validatedParams.kitId)); },
  async completeItem(req, res) { res.json(await classesService.completeItem(req.auth.userId, req.validatedParams.itemId)); },
};
