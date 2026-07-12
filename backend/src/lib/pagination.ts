import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'page must be at least 1').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'pageSize must be at least 1')
    .max(100, 'pageSize cannot exceed 100')
    .default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function toSkipTake({ page, pageSize }: PaginationQuery) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildMeta({ page, pageSize }: PaginationQuery, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
