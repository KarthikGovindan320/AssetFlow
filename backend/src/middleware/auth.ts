import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/jwt';
import { ApiError } from '../lib/http-error';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication required. Please sign in.');
    }
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, departmentId: true, status: true },
    });
    if (!user) throw ApiError.unauthorized('This account no longer exists.');
    if (user.status !== 'ACTIVE') {
      throw ApiError.unauthorized('This account has been deactivated.', 'ACCOUNT_INACTIVE');
    }
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    };
    next();
  } catch (err) {
    next(err);
  }
}
