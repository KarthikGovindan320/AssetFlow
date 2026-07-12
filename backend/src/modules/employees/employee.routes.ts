import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './employee.controller';

export const employeeRouter = Router();

employeeRouter.use(requireAuth);

employeeRouter.get('/', asyncHandler(controller.list));
employeeRouter.get('/:id', asyncHandler(controller.get));
employeeRouter.patch('/:id', requireRole('ADMIN'), asyncHandler(controller.update));
employeeRouter.post('/:id/role', requireRole('ADMIN'), asyncHandler(controller.setRole));
