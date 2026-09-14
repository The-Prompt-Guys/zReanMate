import { Router } from 'express';

import { foldersController } from '../controllers/folders.controller.js';
import { authenticated } from '../middleware/guards.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  createFolderSchema,
  folderIdParams,
  updateFolderSchema,
} from '../validation/kits.schemas.js';

const router = Router();

router.use(...authenticated);

router.get('/', foldersController.list);
router.post('/', validateBody(createFolderSchema), foldersController.create);
router.get('/:folderId', validateParams(folderIdParams), foldersController.show);
router.patch(
  '/:folderId',
  validateParams(folderIdParams),
  validateBody(updateFolderSchema),
  foldersController.update,
);
router.delete('/:folderId', validateParams(folderIdParams), foldersController.destroy);

export default router;
