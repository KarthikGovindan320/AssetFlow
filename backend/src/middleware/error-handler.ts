import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../lib/http-error';
import { env } from '../config/env';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
    });
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || '_';
      if (!fields[path]) fields[path] = issue.message;
    }
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: { fields } },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta!.target as string[]).join(', ') : 'value';
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_VALUE',
          message: `A record with this ${target} already exists.`,
        },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'The requested record was not found.' },
      });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: {
          code: 'REFERENCE_CONSTRAINT',
          message: 'This record is referenced by other data and cannot be modified this way.',
        },
      });
    }
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      details: env.NODE_ENV === 'development' && err instanceof Error ? { stack: err.stack } : undefined,
    },
  });
}
