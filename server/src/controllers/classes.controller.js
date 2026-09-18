import { classesService } from '../services/classes.service.js';

export const classesController = {
  async list(req, res) { res.json(await classesService.list(req.auth.userId)); },
  async show(req, res) { res.json(await classesService.get(req.auth.userId, req.validatedParams.classId)); },
  async remove(req, res) { res.json(await classesService.remove(req.auth.userId, req.validatedParams.classId)); },
  async create(req, res) { res.status(201).json(await classesService.create(req.auth.userId, req.body)); },
  async setCover(req, res) { res.status(201).json(await classesService.setCover(req.auth.userId, req.validatedParams.classId, req.file)); },
  async cover(req, res) {
    const image = await classesService.cover(req.auth.userId, req.validatedParams.classId);
    res.type(image.mimeType).sendFile(image.path);
  },
  async join(req, res) { res.status(201).json(await classesService.join(req.auth.userId, req.body.code)); },
  async createLesson(req, res) { res.status(201).json(await classesService.createLesson(req.auth.userId, req.validatedParams.classId, req.body)); },
  async shareKit(req, res) { res.json(await classesService.shareKit(req.auth.userId, req.validatedParams.classId, req.validatedParams.kitId)); },
  async completeItem(req, res) { res.json(await classesService.completeItem(req.auth.userId, req.validatedParams.itemId)); },
};
