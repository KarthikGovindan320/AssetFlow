import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './transfer.controller';

export const transferRouter = Router();

transferRouter.use(requireAuth);
transferRouter.get('/', asyncHandler(controller.list));

transferRouter.post('/', asyncHandler(controller.create));
transferRouter.post(
  '/:id/approve',
  requireRole('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'),
  asyncHandler(controller.approve),
);
transferRouter.post(
  '/:id/reject',
  requireRole('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'),
  asyncHandler(controller.reject),
);
