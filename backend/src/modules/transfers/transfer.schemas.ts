import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination';

export const createTransferSchema = z
  .object({
    assetId: z.string().min(1, 'Asset is required'),
    requestedForUserId: z.string().min(1).optional(),
    requestedForDepartmentId: z.string().min(1).optional(),
    reason: z
      .string()
      .trim()
      .min(5, 'Please give a short reason for the transfer (at least 5 characters)')
      .max(500),
  })
  .refine(
    (v) => Boolean(v.requestedForUserId) !== Boolean(v.requestedForDepartmentId),
    { message: 'Request the transfer for exactly one target: an employee or a department', path: ['requestedForUserId'] },
  );

export const decideTransferSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const listTransfersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED']).optional(),
  assetId: z.string().optional(),
});
