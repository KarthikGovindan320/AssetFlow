import { z } from 'zod';

export const customFieldDefSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Field key is required')
    .max(50)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Field key must start with a letter and use only letters, numbers, and underscores'),
  label: z.string().trim().min(1, 'Field label is required').max(100),
  type: z.enum(['text', 'number', 'date'], { message: 'Field type must be text, number, or date' }),
  required: z.boolean().default(false),
});

export type CustomFieldDef = z.infer<typeof customFieldDefSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
  customFields: z
    .array(customFieldDefSchema)
    .max(20, 'A category cannot define more than 20 custom fields')
    .default([])
    .refine(
      (fields) => new Set(fields.map((f) => f.key)).size === fields.length,
      'Custom field keys must be unique',
    ),
});

export const updateCategorySchema = createCategorySchema.partial();
