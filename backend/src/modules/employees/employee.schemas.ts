import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination';

export const listEmployeesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  role: z.enum(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE']).optional(),
  departmentId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  departmentId: z.string().min(1).nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const setRoleSchema = z.object({
  role: z.enum(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'], {
    message: 'Role must be one of ADMIN, ASSET_MANAGER, DEPARTMENT_HEAD, EMPLOYEE',
  }),
});
