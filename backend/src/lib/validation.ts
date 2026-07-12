import { Request } from 'express';
import { z, ZodError, ZodType } from 'zod';
import { ApiError } from './http-error';

function zodToFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}

function parseOrThrow<T extends ZodType>(schema: T, data: unknown, source: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ApiError.badRequest('VALIDATION_ERROR', `Invalid request ${source}`, {
      fields: zodToFieldErrors(result.error),
    });
  }
  return result.data;
}

export function parseBody<T extends ZodType>(schema: T, req: Request): z.infer<T> {
  return parseOrThrow(schema, req.body, 'body');
}

export function parseQuery<T extends ZodType>(schema: T, req: Request): z.infer<T> {
  return parseOrThrow(schema, req.query, 'query');
}

export function parseParams<T extends ZodType>(schema: T, req: Request): z.infer<T> {
  return parseOrThrow(schema, req.params, 'params');
}

export const idParamSchema = z.object({ id: z.string().min(1, 'id is required') });
