import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination';

const ASSET_STATUSES = [
  'AVAILABLE',
  'ALLOCATED',
  'RESERVED',
  'UNDER_MAINTENANCE',
  'LOST',
  'RETIRED',
  'DISPOSED',
] as const;

const CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR'] as const;

export const createAssetSchema = z.object({
  name: z.string().trim().min(2, 'Asset name must be at least 2 characters').max(150),
  categoryId: z.string().min(1, 'Category is required'),
  serialNumber: z.string().trim().min(1).max(100).nullish(),
  acquisitionDate: z.coerce
    .date({ message: 'Acquisition date must be a valid date' })
    .refine((d) => d.getTime() <= Date.now(), 'Acquisition date cannot be in the future'),
  acquisitionCost: z.coerce
    .number({ message: 'Acquisition cost must be a number' })
    .positive('Acquisition cost must be a positive number')
    .max(999_999_999, 'Acquisition cost is unrealistically large'),
  condition: z.enum(CONDITIONS).default('GOOD'),
  location: z.string().trim().min(1, 'Location is required').max(150),
  isBookable: z.boolean().default(false),
  customFieldValues: z.record(z.string(), z.unknown()).optional(),
  photoUrl: z.string().trim().url('Photo must be a valid URL').max(500).nullish(),
  expectedRetirementDate: z.coerce.date().nullish(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const listAssetsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(), 
  categoryId: z.string().optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  location: z.string().trim().optional(),
  departmentId: z.string().optional(), 
  isBookable: z.coerce.boolean().optional(),
});

export const setAssetStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED', 'LOST', 'RETIRED', 'DISPOSED'], {
    message:
      'Manual status must be one of AVAILABLE, RESERVED, LOST, RETIRED, DISPOSED — allocation and maintenance statuses are set by their workflows',
  }),
  reason: z.string().trim().max(500).optional(),
});
