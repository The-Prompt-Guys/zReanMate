import { kitsService } from '../services/kits.service.js';
import { sourcesService } from '../services/sources.service.js';

/** Routes wire; controllers translate HTTP; services hold the logic. */
export const kitsController = {
  async list(req, res) {
    const { status, q } = req.validatedQuery ?? {};
    const kits = await kitsService.list(req.auth.userId, { status, q });
    res.json({ kits });
  },

  async create(req, res) {
    const kit = await kitsService.create(req.auth.userId, req.body);
    res.status(201).json({ kit });
  },

  async show(req, res) {
    const kit = await kitsService.get(req.auth.userId, req.validatedParams.kitId);
    // fileCount is on the kit, but the contract names it alongside — the file
    // list header reads both in one go.
    res.json({ kit, fileCount: kit.fileCount });
  },

  async update(req, res) {
    const kit = await kitsService.update(req.auth.userId, req.validatedParams.kitId, req.body);
    res.json({ kit });
  },

  async destroy(req, res) {
    const result = await kitsService.remove(req.auth.userId, req.validatedParams.kitId);
    res.json(result);
  },

  async quota(req, res) {
    res.json(await kitsService.quota(req.auth.userId));
  },

  async listSources(req, res) {
    const sources = await sourcesService.listForKit(req.auth.userId, req.validatedParams.kitId);
    res.json({ sources });
  },

  /**
   * 202, not 201: the row exists but processing runs asynchronously.
   * Handles multipart file uploads (PDF/image) and JSON (YouTube, topic).
   */
  async createSource(req, res) {
    const kitId = req.validatedParams.kitId;
    let source;
    if (req.file) {
      source = await sourcesService.createFromUpload(req.auth.userId, kitId, req.file);
    } else {
      source = await sourcesService.createFromInput(req.auth.userId, kitId, req.body);
    }
    res.status(202).json({ source });
  },

  async showSource(req, res) {
    const { kitId, sourceId } = req.validatedParams;
    res.json({ source: await sourcesService.get(req.auth.userId, kitId, sourceId) });
  },

  async destroySource(req, res) {
    const { kitId, sourceId } = req.validatedParams;
    res.json(await sourcesService.remove(req.auth.userId, kitId, sourceId));
  },
};
