import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination';

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
  parentDepartmentId: z.string().min(1).nullish(),
  headUserId: z.string().min(1).nullish(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const listDepartmentsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
