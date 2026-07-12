import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination';

export const createAllocationSchema = z
  .object({
    assetId: z.string().min(1, 'Asset is required'),
    allocatedToUserId: z.string().min(1).optional(),
    allocatedToDepartmentId: z.string().min(1).optional(),
    expectedReturnDate: z.coerce
      .date({ message: 'Expected return date must be a valid date' })
      .refine((d) => d.getTime() > Date.now(), 'Expected return date must be in the future')
      .optional(),
  })
  .refine(
    (v) => Boolean(v.allocatedToUserId) !== Boolean(v.allocatedToDepartmentId),
    { message: 'Allocate to exactly one target: an employee or a department', path: ['allocatedToUserId'] },
  );

export const returnAllocationSchema = z.object({
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR'], {
    message: 'Check-in condition must be NEW, GOOD, FAIR, or POOR',
  }),
  notes: z.string().trim().max(1000).optional(),
});

export const listAllocationsQuerySchema = paginationQuerySchema.extend({
  assetId: z.string().optional(),
  state: z.enum(['ACTIVE', 'RETURNED', 'OVERDUE']).optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
});
