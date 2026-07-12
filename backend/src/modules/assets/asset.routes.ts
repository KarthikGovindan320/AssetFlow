import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './asset.controller';

export const assetRouter = Router();

assetRouter.use(requireAuth);
assetRouter.get('/', asyncHandler(controller.list));
assetRouter.get('/locations', asyncHandler(controller.locations));
assetRouter.get('/:id', asyncHandler(controller.get));
assetRouter.post('/', requireRole('ADMIN', 'ASSET_MANAGER'), asyncHandler(controller.create));
assetRouter.patch('/:id', requireRole('ADMIN', 'ASSET_MANAGER'), asyncHandler(controller.update));
assetRouter.patch(
  '/:id/status',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(controller.setStatus),
);
