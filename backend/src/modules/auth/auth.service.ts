import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/http-error';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../lib/jwt';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../../lib/password';
import { logActivity } from '../activity/activity.service';

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  createdAt: true,
} as const;

async function issueTokenPair(user: { id: string; role: any; departmentId: string | null }) {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    departmentId: user.departmentId,
  });
  const refreshToken = signRefreshToken({ sub: user.id, jti: generateOpaqueToken(16) });
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: hashToken(refreshToken) },
  });
  return { accessToken, refreshToken };
}

export async function signup(input: {
  name: string;
  email: string;
  password: string;
  departmentId?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict('EMAIL_TAKEN', 'An account with this email already exists.', {
      fields: { email: 'An account with this email already exists' },
    });
  }
  if (input.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!dept || dept.status !== 'ACTIVE') {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
        fields: { departmentId: 'Selected department does not exist or is inactive' },
      });
    }
  }
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: 'EMPLOYEE',
      departmentId: input.departmentId,
    },
    select: PUBLIC_USER_SELECT,
  });
  await logActivity({
    actorUserId: user.id,
    action: 'auth.signup',
    entityType: 'User',
    entityId: user.id,
    metadata: { email: user.email },
  });
  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const genericError = ApiError.unauthorized('Incorrect email or password.', 'INVALID_CREDENTIALS');
  if (!user) throw genericError;
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw genericError;
  if (user.status !== 'ACTIVE') {
    throw ApiError.unauthorized(
      'This account has been deactivated. Contact your administrator.',
      'ACCOUNT_INACTIVE',
    );
  }
  const publicUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: PUBLIC_USER_SELECT,
  });
  await logActivity({
    actorUserId: user.id,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
  });
  const tokens = await issueTokenPair(user);
  return { user: publicUser, ...tokens };
}

export async function refresh(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
  if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
    throw ApiError.unauthorized('Your session has expired. Please sign in again.', 'REFRESH_TOKEN_REUSED');
  }
  const tokens = await issueTokenPair(user);
  const publicUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: PUBLIC_USER_SELECT,
  });
  return { user: publicUser, ...tokens };
}

export async function logout(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
  await logActivity({
    actorUserId: userId,
    action: 'auth.logout',
    entityType: 'User',
    entityId: userId,
  });
}

export async function me(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PUBLIC_USER_SELECT });
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status === 'ACTIVE') {
    const token = generateOpaqueToken(32);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashToken(token),
        resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    console.log(
      `[password-reset] Reset link for ${email}: http://localhost:5173/reset-password?token=${token}`,
    );
  }
  return {
    message: 'If an account exists for this email, a password reset link has been generated.',
  };
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: { resetTokenHash: hashToken(token), resetTokenExpiresAt: { gt: new Date() } },
  });
  if (!user) {
    throw ApiError.badRequest(
      'RESET_TOKEN_INVALID',
      'This password reset link is invalid or has expired. Please request a new one.',
    );
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      refreshTokenHash: null, 
    },
  });
  await logActivity({
    actorUserId: user.id,
    action: 'auth.password_reset',
    entityType: 'User',
    entityId: user.id,
  });
  return { message: 'Your password has been reset. You can now sign in.' };
}
