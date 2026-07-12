import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/http-error';
import { buildMeta, PaginationQuery, toSkipTake } from '../../lib/pagination';
import { logActivity } from '../activity/activity.service';

const EMPLOYEE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function listEmployees(
  query: PaginationQuery & {
    q?: string;
    role?: Role;
    departmentId?: string;
    status?: 'ACTIVE' | 'INACTIVE';
  },
) {
  const where: Prisma.UserWhereInput = {
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: EMPLOYEE_SELECT,
      orderBy: { name: 'asc' },
      ...toSkipTake(query),
    }),
    prisma.user.count({ where }),
  ]);
  return { data, meta: buildMeta(query, total) };
}

export async function getEmployee(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: EMPLOYEE_SELECT });
  if (!user) throw ApiError.notFound('Employee not found.');
  return user;
}

export async function updateEmployee(
  actorId: string,
  id: string,
  input: { name?: string; departmentId?: string | null; status?: 'ACTIVE' | 'INACTIVE' },
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('Employee not found.');

  if (input.status === 'INACTIVE') {
    if (id === actorId) {
      throw ApiError.conflict('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account.');
    }
    await assertNotLastActiveAdmin(user.id, user.role, 'deactivate');
  }
  if (input.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!dept || dept.status !== 'ACTIVE') {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
        fields: { departmentId: 'Selected department does not exist or is inactive' },
      });
    }
  }

  const updated = await prisma.user.update({ where: { id }, data: input, select: EMPLOYEE_SELECT });
  await logActivity({
    actorUserId: actorId,
    action: 'employee.updated',
    entityType: 'User',
    entityId: id,
    metadata: { changes: input as Prisma.InputJsonValue },
  });
  return updated;
}

async function assertNotLastActiveAdmin(userId: string, currentRole: Role, verb: string) {
  if (currentRole !== 'ADMIN') return;
  const otherActiveAdmins = await prisma.user.count({
    where: { role: 'ADMIN', status: 'ACTIVE', id: { not: userId } },
  });
  if (otherActiveAdmins === 0) {
    throw ApiError.conflict(
      'LAST_ADMIN',
      `Cannot ${verb} the only active administrator. Promote another admin first.`,
    );
  }
}

export async function setRole(actorId: string, id: string, role: Role) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('Employee not found.');
  if (user.role === role) return getEmployee(id);

  if (id === actorId && user.role === 'ADMIN' && role !== 'ADMIN') {

    await assertNotLastActiveAdmin(id, user.role, 'demote');
  } else {
    await assertNotLastActiveAdmin(id, user.role, 'demote');
  }

  const updated = await prisma.user.update({ where: { id }, data: { role }, select: EMPLOYEE_SELECT });
  await logActivity({
    actorUserId: actorId,
    action: 'employee.role_changed',
    entityType: 'User',
    entityId: id,
    metadata: { from: user.role, to: role },
  });
  return updated;
}
