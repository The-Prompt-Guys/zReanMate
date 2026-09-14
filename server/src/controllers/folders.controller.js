import { foldersService } from '../services/folders.service.js';

export const foldersController = {
  async list(req, res) {
    res.json({ folders: await foldersService.list(req.auth.userId) });
  },

  async create(req, res) {
    const folder = await foldersService.create(req.auth.userId, req.body);
    res.status(201).json({ folder });
  },

  async show(req, res) {
    const folder = await foldersService.get(req.auth.userId, req.validatedParams.folderId);
    res.json({ folder });
  },

  async update(req, res) {
    const folder = await foldersService.update(
      req.auth.userId,
      req.validatedParams.folderId,
      req.body,
    );
    res.json({ folder });
  },

  async destroy(req, res) {
    res.json(await foldersService.remove(req.auth.userId, req.validatedParams.folderId));
  },
};
