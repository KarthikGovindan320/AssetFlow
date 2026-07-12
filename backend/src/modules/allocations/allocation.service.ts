import { AssetCondition, Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/http-error';
import { buildMeta, PaginationQuery, toSkipTake } from '../../lib/pagination';
import type { Actor } from '../../lib/actor';
import { logActivity } from '../activity/activity.service';
import { notify } from '../notifications/notification.service';
import { transitionAssetStatus } from '../assets/asset-status.service';

export type { Actor };

const ALLOCATION_INCLUDE = {
  asset: { select: { id: true, assetTag: true, name: true, status: true, condition: true } },
  allocatedToUser: { select: { id: true, name: true, departmentId: true } },
  allocatedToDepartment: { select: { id: true, name: true } },
  allocatedBy: { select: { id: true, name: true } },
} satisfies Prisma.AllocationInclude;

function holderName(a: {
  allocatedToUser: { name: string } | null;
  allocatedToDepartment: { name: string } | null;
}): string {
  return a.allocatedToUser?.name ?? a.allocatedToDepartment?.name ?? 'unknown';
}

async function assertActorMayAllocate(
  actor: Actor,
  target: { userId?: string; departmentId?: string },
) {
  if (actor.role === 'ADMIN' || actor.role === 'ASSET_MANAGER') return;
  if (actor.role !== 'DEPARTMENT_HEAD') {
    throw ApiError.forbidden('Only Admins, Asset Managers, and Department Heads can allocate assets.');
  }
  if (!actor.departmentId) {
    throw ApiError.forbidden('You are not assigned to a department, so you cannot allocate within one.');
  }
  if (target.departmentId && target.departmentId !== actor.departmentId) {
    throw ApiError.forbidden('Department Heads can only allocate to their own department.');
  }
  if (target.userId) {
    const targetUser = await prisma.user.findUnique({ where: { id: target.userId } });
    if (!targetUser || targetUser.departmentId !== actor.departmentId) {
      throw ApiError.forbidden('Department Heads can only allocate to employees in their own department.');
    }
  }
}

export async function createAllocation(
  actor: Actor,
  input: {
    assetId: string;
    allocatedToUserId?: string;
    allocatedToDepartmentId?: string;
    expectedReturnDate?: Date;
  },
) {
  await assertActorMayAllocate(actor, {
    userId: input.allocatedToUserId,
    departmentId: input.allocatedToDepartmentId,
  });

  if (input.allocatedToUserId) {
    const target = await prisma.user.findUnique({ where: { id: input.allocatedToUserId } });
    if (!target || target.status !== 'ACTIVE') {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
        fields: { allocatedToUserId: 'Selected employee does not exist or is inactive' },
      });
    }
  }
  if (input.allocatedToDepartmentId) {
    const target = await prisma.department.findUnique({ where: { id: input.allocatedToDepartmentId } });
    if (!target || target.status !== 'ACTIVE') {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
        fields: { allocatedToDepartmentId: 'Selected department does not exist or is inactive' },
      });
    }
  }

  const allocation = await prisma.$transaction(async (tx) => {

    await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${input.assetId} FOR UPDATE`;
    const asset = await tx.asset.findUnique({ where: { id: input.assetId } });
    if (!asset) throw ApiError.notFound('Asset not found.');

    const existing = await tx.allocation.findFirst({
      where: { assetId: input.assetId, returnedAt: null },
      include: {
        allocatedToUser: { select: { id: true, name: true } },
        allocatedToDepartment: { select: { id: true, name: true } },
      },
    });
    if (existing) {
      const holder = existing.allocatedToUser
        ? { type: 'USER' as const, id: existing.allocatedToUser.id, name: existing.allocatedToUser.name }
        : {
            type: 'DEPARTMENT' as const,
            id: existing.allocatedToDepartment!.id,
            name: existing.allocatedToDepartment!.name,
          };

      throw ApiError.conflict(
        'ASSET_ALREADY_ALLOCATED',
        `${asset.name} ${asset.assetTag} is currently held by ${holder.name}.`,
        {
          assetId: asset.id,
          assetTag: asset.assetTag,
          currentHolder: holder,
          allocationId: existing.id,
          allocatedAt: existing.allocatedAt,
          expectedReturnDate: existing.expectedReturnDate,
          suggestedAction: 'TRANSFER_REQUEST',
        },
      );
    }

    if (asset.status !== 'AVAILABLE' && asset.status !== 'RESERVED') {
      throw ApiError.conflict(
        'ASSET_NOT_AVAILABLE',
        `Asset ${asset.assetTag} is ${asset.status.replaceAll('_', ' ').toLowerCase()} and cannot be allocated.`,
        { assetId: asset.id, assetTag: asset.assetTag, status: asset.status },
      );
    }

    const created = await tx.allocation.create({
      data: {
        assetId: input.assetId,
        allocatedToUserId: input.allocatedToUserId ?? null,
        allocatedToDepartmentId: input.allocatedToDepartmentId ?? null,
        allocatedById: actor.id,
        expectedReturnDate: input.expectedReturnDate ?? null,
      },
      include: ALLOCATION_INCLUDE,
    });
    await transitionAssetStatus(
      tx,
      input.assetId,
      'ALLOCATED',
      actor.id,
      `Allocated to ${holderName(created)}`,
    );
    if (input.allocatedToUserId) {
      await notify(
        {
          userIds: [input.allocatedToUserId],
          type: 'ASSET_ASSIGNED',
          title: 'Asset assigned to you',
          body: `${created.asset.name} (${created.asset.assetTag}) has been allocated to you by ${actor.name}.`,
          entityType: 'Allocation',
          entityId: created.id,
        },
        tx,
      );
    }
    await logActivity(
      {
        actorUserId: actor.id,
        action: 'allocation.created',
        entityType: 'Allocation',
        entityId: created.id,
        metadata: {
          assetTag: created.asset.assetTag,
          holder: holderName(created),
          expectedReturnDate: created.expectedReturnDate?.toISOString() ?? null,
        },
      },
      tx,
    );

    return tx.allocation.findUniqueOrThrow({ where: { id: created.id }, include: ALLOCATION_INCLUDE });
  });
  return decorate(allocation);
}

export async function returnAllocation(
  actor: Actor,
  allocationId: string,
  input: { condition: AssetCondition; notes?: string },
) {
  const allocation = await prisma.$transaction(async (tx) => {
    const existing = await tx.allocation.findUnique({
      where: { id: allocationId },
      include: ALLOCATION_INCLUDE,
    });
    if (!existing) throw ApiError.notFound('Allocation not found.');
    if (existing.returnedAt) {
      throw ApiError.conflict('ALREADY_RETURNED', 'This allocation has already been returned.');
    }
    await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${existing.assetId} FOR UPDATE`;

    const updated = await tx.allocation.update({
      where: { id: allocationId },
      data: {
        returnedAt: new Date(),
        status: 'RETURNED',
        returnCondition: input.condition,
        returnNotes: input.notes,
      },
      include: ALLOCATION_INCLUDE,
    });

    await tx.asset.update({
      where: { id: existing.assetId },
      data: { condition: input.condition },
    });
    await transitionAssetStatus(
      tx,
      existing.assetId,
      'AVAILABLE',
      actor.id,
      `Returned by ${holderName(existing)} (condition: ${input.condition})`,
    );
    if (existing.allocatedToUserId) {
      await notify(
        {
          userIds: [existing.allocatedToUserId],
          type: 'ASSET_RETURNED',
          title: 'Asset return processed',
          body: `Your return of ${existing.asset.name} (${existing.asset.assetTag}) was checked in as ${input.condition}.`,
          entityType: 'Allocation',
          entityId: allocationId,
        },
        tx,
      );
    }
    await logActivity(
      {
        actorUserId: actor.id,
        action: 'allocation.returned',
        entityType: 'Allocation',
        entityId: allocationId,
        metadata: { assetTag: existing.asset.assetTag, condition: input.condition, notes: input.notes ?? null },
      },
      tx,
    );

    return tx.allocation.findUniqueOrThrow({ where: { id: updated.id }, include: ALLOCATION_INCLUDE });
  });
  return decorate(allocation);
}

function decorate<T extends { expectedReturnDate: Date | null; returnedAt: Date | null }>(a: T) {
  return {
    ...a,
    isOverdue: !a.returnedAt && !!a.expectedReturnDate && a.expectedReturnDate.getTime() < Date.now(),
  };
}

export async function listAllocations(
  actor: Actor,
  query: PaginationQuery & {
    assetId?: string;
    state?: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
    departmentId?: string;
    userId?: string;
  },
) {
  const where: Prisma.AllocationWhereInput = {
    ...(query.assetId ? { assetId: query.assetId } : {}),
    ...(query.userId ? { allocatedToUserId: query.userId } : {}),
    ...(query.departmentId
      ? {
          OR: [
            { allocatedToDepartmentId: query.departmentId },
            { allocatedToUser: { departmentId: query.departmentId } },
          ],
        }
      : {}),
  };
  if (query.state === 'ACTIVE') where.returnedAt = null;
  if (query.state === 'RETURNED') where.returnedAt = { not: null };
  if (query.state === 'OVERDUE') {
    where.returnedAt = null;
    where.expectedReturnDate = { lt: new Date() };
  }

  if (actor.role === 'EMPLOYEE') {
    where.allocatedToUserId = actor.id;
  } else if (actor.role === 'DEPARTMENT_HEAD' && actor.departmentId) {
    where.AND = [
      {
        OR: [
          { allocatedToDepartmentId: actor.departmentId },
          { allocatedToUser: { departmentId: actor.departmentId } },
          { allocatedToUserId: actor.id },
        ],
      },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.allocation.findMany({
      where,
      include: ALLOCATION_INCLUDE,
      orderBy: [{ returnedAt: { sort: 'asc', nulls: 'first' } }, { allocatedAt: 'desc' }],
      ...toSkipTake(query),
    }),
    prisma.allocation.count({ where }),
  ]);
  return { data: rows.map(decorate), meta: buildMeta(query, total) };
}
