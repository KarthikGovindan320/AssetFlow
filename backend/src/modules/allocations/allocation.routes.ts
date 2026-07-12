import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './allocation.controller';

export const allocationRouter = Router();

allocationRouter.use(requireAuth);
allocationRouter.get('/', asyncHandler(controller.list));
allocationRouter.post(
  '/',
  requireRole('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'),
  asyncHandler(controller.create),
);
allocationRouter.post(
  '/:id/return',
  requireRole('ADMIN', 'ASSET_MANAGER'),
  asyncHandler(controller.returnAsset),
);
