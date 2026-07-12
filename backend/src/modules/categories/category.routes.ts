import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './category.controller';

export const categoryRouter = Router();

categoryRouter.use(requireAuth);
categoryRouter.get('/', asyncHandler(controller.list));
categoryRouter.get('/:id', asyncHandler(controller.get));
categoryRouter.post('/', requireRole('ADMIN'), asyncHandler(controller.create));
categoryRouter.patch('/:id', requireRole('ADMIN'), asyncHandler(controller.update));
categoryRouter.delete('/:id', requireRole('ADMIN'), asyncHandler(controller.remove));
