import { Router } from 'express';

import { kitsController } from '../controllers/kits.controller.js';
import { authenticated } from '../middleware/guards.js';
import { handleUpload } from '../middleware/upload.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  createKitSchema,
  createSourceSchema,
  kitIdParams,
  kitListQuery,
  sourceIdParams,
  updateKitSchema,
} from '../validation/kits.schemas.js';

const router = Router();

// Every kit route is scoped to the signed-in user; ownership is enforced in SQL
// (kits.db.js), not by a check the next query could forget.
router.use(...authenticated);

router.get('/', validateQuery(kitListQuery), kitsController.list);
router.post('/', validateBody(createKitSchema), kitsController.create);

// Static path before the parameterised one, or "quota" parses as a kit id.
router.get('/quota', kitsController.quota);

router.get('/:kitId', validateParams(kitIdParams), kitsController.show);
router.patch(
  '/:kitId',
  validateParams(kitIdParams),
  validateBody(updateKitSchema),
  kitsController.update,
);
router.delete('/:kitId', validateParams(kitIdParams), kitsController.destroy);

// Sources: uploaded files now, YouTube/link/topic on the same endpoint.
router.get('/:kitId/sources', validateParams(kitIdParams), kitsController.listSources);
router.get('/:kitId/files', validateParams(kitIdParams), kitsController.listSources);

const validateSourceBody = (req, res, next) => {
  if (req.is('multipart/form-data') || req.file) {
    return next();
  }
  return validateBody(createSourceSchema)(req, res, next);
};

/**
 * Params are validated before multer runs, so a bad kit id is rejected without
 * writing anything to disk.
 */
router.post(
  '/:kitId/sources',
  validateParams(kitIdParams),
  handleUpload,
  validateSourceBody,
  kitsController.createSource,
);
router.post(
  '/:kitId/files',
  validateParams(kitIdParams),
  handleUpload,
  validateSourceBody,
  kitsController.createSource,
);

router.get('/:kitId/sources/:sourceId', validateParams(sourceIdParams), kitsController.showSource);
router.get('/:kitId/files/:sourceId', validateParams(sourceIdParams), kitsController.showSource);
router.delete(
  '/:kitId/sources/:sourceId',
  validateParams(sourceIdParams),
  kitsController.destroySource,
);
router.delete(
  '/:kitId/files/:sourceId',
  validateParams(sourceIdParams),
  kitsController.destroySource,
);

export default router;
