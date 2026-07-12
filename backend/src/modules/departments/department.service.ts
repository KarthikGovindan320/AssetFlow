import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/http-error';
import { buildMeta, PaginationQuery, toSkipTake } from '../../lib/pagination';
import { logActivity } from '../activity/activity.service';

const DEPARTMENT_INCLUDE = {
  head: { select: { id: true, name: true, email: true } },
  parentDepartment: { select: { id: true, name: true } },
  _count: { select: { members: true, childDepartments: true } },
} satisfies Prisma.DepartmentInclude;

async function assertValidHead(headUserId: string) {
  const head = await prisma.user.findUnique({ where: { id: headUserId } });
  if (!head || head.status !== 'ACTIVE') {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
      fields: { headUserId: 'Selected department head does not exist or is inactive' },
    });
  }
}

export async function listDepartments(
  query: PaginationQuery & { q?: string; status?: 'ACTIVE' | 'INACTIVE' },
) {
  const where: Prisma.DepartmentWhereInput = {
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.department.findMany({
      where,
      include: DEPARTMENT_INCLUDE,
      orderBy: { name: 'asc' },
      ...toSkipTake(query),
    }),
    prisma.department.count({ where }),
  ]);
  return { data, meta: buildMeta(query, total) };
}

export async function departmentOptions() {
  return prisma.department.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, parentDepartmentId: true },
    orderBy: { name: 'asc' },
  });
}

export async function getDepartment(id: string) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      ...DEPARTMENT_INCLUDE,
      childDepartments: { select: { id: true, name: true, status: true } },
    },
  });
  if (!department) throw ApiError.notFound('Department not found.');
  return department;
}

export async function createDepartment(
  actorId: string,
  input: {
    name: string;
    description?: string;
    parentDepartmentId?: string | null;
    headUserId?: string | null;
  },
) {
  const existing = await prisma.department.findUnique({ where: { name: input.name } });
  if (existing) {
    throw ApiError.conflict('DEPARTMENT_NAME_TAKEN', `A department named "${input.name}" already exists.`, {
      fields: { name: 'A department with this name already exists' },
    });
  }
  if (input.parentDepartmentId) {
    const parent = await prisma.department.findUnique({ where: { id: input.parentDepartmentId } });
    if (!parent) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
        fields: { parentDepartmentId: 'Selected parent department does not exist' },
      });
    }
  }
  if (input.headUserId) await assertValidHead(input.headUserId);

  const department = await prisma.department.create({
    data: {
      name: input.name,
      description: input.description,
      parentDepartmentId: input.parentDepartmentId ?? null,
      headUserId: input.headUserId ?? null,
    },
    include: DEPARTMENT_INCLUDE,
  });
  await logActivity({
    actorUserId: actorId,
    action: 'department.created',
    entityType: 'Department',
    entityId: department.id,
    metadata: { name: department.name },
  });
  return department;
}

export async function updateDepartment(
  actorId: string,
  id: string,
  input: {
    name?: string;
    description?: string;
    parentDepartmentId?: string | null;
    headUserId?: string | null;
  },
) {
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw ApiError.notFound('Department not found.');

  if (input.name && input.name !== department.name) {
    const clash = await prisma.department.findUnique({ where: { name: input.name } });
    if (clash) {
      throw ApiError.conflict('DEPARTMENT_NAME_TAKEN', `A department named "${input.name}" already exists.`, {
        fields: { name: 'A department with this name already exists' },
      });
    }
  }
  if (input.parentDepartmentId) {
    if (input.parentDepartmentId === id) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
        fields: { parentDepartmentId: 'A department cannot be its own parent' },
      });
    }

    let cursor: string | null = input.parentDepartmentId;
    while (cursor) {
      if (cursor === id) {
        throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
          fields: { parentDepartmentId: 'This assignment would create a cycle in the department hierarchy' },
        });
      }
      const parent: { parentDepartmentId: string | null } | null =
        await prisma.department.findUnique({
          where: { id: cursor },
          select: { parentDepartmentId: true },
        });
      if (!parent) {
        throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
          fields: { parentDepartmentId: 'Selected parent department does not exist' },
        });
      }
      cursor = parent.parentDepartmentId;
    }
  }
  if (input.headUserId) await assertValidHead(input.headUserId);

  const updated = await prisma.department.update({
    where: { id },
    data: input,
    include: DEPARTMENT_INCLUDE,
  });
  await logActivity({
    actorUserId: actorId,
    action: 'department.updated',
    entityType: 'Department',
    entityId: id,
    metadata: { changes: input as Prisma.InputJsonValue },
  });
  return updated;
}

export async function setDepartmentStatus(actorId: string, id: string, status: 'ACTIVE' | 'INACTIVE') {
  const department = await prisma.department.findUnique({
    where: { id },
    include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } },
  });
  if (!department) throw ApiError.notFound('Department not found.');
  if (department.status === status) return department;

  if (status === 'INACTIVE') {
    const activeMembers = department._count.members;
    if (activeMembers > 0) {
      throw ApiError.conflict(
        'DEPARTMENT_HAS_MEMBERS',
        `Cannot deactivate "${department.name}": ${activeMembers} active employee(s) still belong to it. Reassign them first.`,
      );
    }
    const activeAllocations = await prisma.allocation.count({
      where: { allocatedToDepartmentId: id, returnedAt: null },
    });
    if (activeAllocations > 0) {
      throw ApiError.conflict(
        'DEPARTMENT_HAS_ALLOCATIONS',
        `Cannot deactivate "${department.name}": ${activeAllocations} asset(s) are still allocated to it. Return them first.`,
      );
    }
  }

  const updated = await prisma.department.update({
    where: { id },
    data: { status },
    include: DEPARTMENT_INCLUDE,
  });
  await logActivity({
    actorUserId: actorId,
    action: status === 'INACTIVE' ? 'department.deactivated' : 'department.activated',
    entityType: 'Department',
    entityId: id,
    metadata: { name: department.name },
  });
  return updated;
}

export async function departmentTree() {
  const all = await prisma.department.findMany({
    include: DEPARTMENT_INCLUDE,
    orderBy: { name: 'asc' },
  });
  type Node = (typeof all)[number] & { children: Node[] };
  const byId = new Map<string, Node>(all.map((d) => [d.id, { ...d, children: [] }]));
  const roots: Node[] = [];
  for (const node of byId.values()) {
    if (node.parentDepartmentId && byId.has(node.parentDepartmentId)) {
      byId.get(node.parentDepartmentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
