import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './department.controller';

export const departmentRouter = Router();

departmentRouter.get('/options', asyncHandler(controller.options));

departmentRouter.use(requireAuth);
departmentRouter.get('/', asyncHandler(controller.list));
departmentRouter.get('/tree', asyncHandler(controller.tree));
departmentRouter.get('/:id', asyncHandler(controller.get));
departmentRouter.post('/', requireRole('ADMIN'), asyncHandler(controller.create));
departmentRouter.patch('/:id', requireRole('ADMIN'), asyncHandler(controller.update));
departmentRouter.post('/:id/deactivate', requireRole('ADMIN'), asyncHandler(controller.deactivate));
departmentRouter.post('/:id/activate', requireRole('ADMIN'), asyncHandler(controller.activate));
