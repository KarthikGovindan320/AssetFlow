import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/http-error';
import { buildMeta, PaginationQuery, toSkipTake } from '../../lib/pagination';
import { logActivity } from '../activity/activity.service';
import { notify, notifyRole } from '../notifications/notification.service';
import type { Actor } from '../../lib/actor';

const TRANSFER_INCLUDE = {
  asset: { select: { id: true, assetTag: true, name: true, status: true } },
  fromAllocation: {
    include: {
      allocatedToUser: { select: { id: true, name: true } },
      allocatedToDepartment: { select: { id: true, name: true } },
    },
  },
  requestedBy: { select: { id: true, name: true } },
  requestedForUser: { select: { id: true, name: true, departmentId: true } },
  requestedForDepartment: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
} satisfies Prisma.TransferRequestInclude;

export async function createTransfer(
  actor: Actor,
  input: {
    assetId: string;
    requestedForUserId?: string;
    requestedForDepartmentId?: string;
    reason: string;
  },
) {
  if (actor.role === 'EMPLOYEE') {
    const forSelf = input.requestedForUserId === actor.id;
    const forOwnDept =
      !!input.requestedForDepartmentId && input.requestedForDepartmentId === actor.departmentId;
    if (!forSelf && !forOwnDept) {
      throw ApiError.forbidden('Employees can request transfers only for themselves or their own department.');
    }
  }

  const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
  if (!asset) throw ApiError.notFound('Asset not found.');

  const activeAllocation = await prisma.allocation.findFirst({
    where: { assetId: input.assetId, returnedAt: null },
    include: {
      allocatedToUser: { select: { id: true, name: true } },
      allocatedToDepartment: { select: { id: true, name: true } },
    },
  });
  if (!activeAllocation) {
    throw ApiError.conflict(
      'ASSET_NOT_ALLOCATED',
      `${asset.name} (${asset.assetTag}) is not currently allocated — it can be allocated directly instead of transferred.`,
    );
  }
  if (
    input.requestedForUserId &&
    activeAllocation.allocatedToUserId === input.requestedForUserId
  ) {
    throw ApiError.conflict(
      'TRANSFER_TO_CURRENT_HOLDER',
      'This asset is already allocated to the requested employee.',
    );
  }

  const pending = await prisma.transferRequest.findFirst({
    where: { assetId: input.assetId, status: 'REQUESTED' },
  });
  if (pending) {
    throw ApiError.conflict(
      'TRANSFER_ALREADY_PENDING',
      `A transfer request for ${asset.assetTag} is already awaiting a decision.`,
      { transferRequestId: pending.id },
    );
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const created = await tx.transferRequest.create({
      data: {
        assetId: input.assetId,
        fromAllocationId: activeAllocation.id,
        requestedById: actor.id,
        requestedForUserId: input.requestedForUserId ?? null,
        requestedForDepartmentId: input.requestedForDepartmentId ?? null,
        reason: input.reason,
      },
      include: TRANSFER_INCLUDE,
    });
    const holderName =
      activeAllocation.allocatedToUser?.name ?? activeAllocation.allocatedToDepartment?.name;
    await notifyRole(
      ['ASSET_MANAGER', 'ADMIN'],
      {
        type: 'TRANSFER_REQUESTED',
        title: 'Transfer request awaiting approval',
        body: `${actor.name} requested a transfer of ${asset.name} (${asset.assetTag}), currently held by ${holderName}.`,
        entityType: 'TransferRequest',
        entityId: created.id,
      },
      tx,
    );
    await logActivity(
      {
        actorUserId: actor.id,
        action: 'transfer.requested',
        entityType: 'TransferRequest',
        entityId: created.id,
        metadata: { assetTag: asset.assetTag, reason: input.reason },
      },
      tx,
    );
    return created;
  });
  return transfer;
}

function assertActorMayDecide(
  actor: Actor,
  transfer: {
    requestedForDepartmentId: string | null;
    requestedForUser: { departmentId: string | null } | null;
  },
) {
  if (actor.role === 'ADMIN' || actor.role === 'ASSET_MANAGER') return;
  if (actor.role === 'DEPARTMENT_HEAD' && actor.departmentId) {
    const targetDept =
      transfer.requestedForDepartmentId ?? transfer.requestedForUser?.departmentId ?? null;
    if (targetDept === actor.departmentId) return;
    throw ApiError.forbidden('Department Heads can only decide transfers within their own department.');
  }
  throw ApiError.forbidden('Only Admins, Asset Managers, and Department Heads can decide transfer requests.');
}

export async function approveTransfer(actor: Actor, id: string, notes?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const transfer = await tx.transferRequest.findUnique({ where: { id }, include: TRANSFER_INCLUDE });
    if (!transfer) throw ApiError.notFound('Transfer request not found.');
    assertActorMayDecide(actor, transfer);
    if (transfer.status !== 'REQUESTED') {
      throw ApiError.conflict(
        'TRANSFER_ALREADY_DECIDED',
        `This transfer request was already ${transfer.status.toLowerCase()}.`,
      );
    }

    await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${transfer.assetId} FOR UPDATE`;
    const currentActive = await tx.allocation.findFirst({
      where: { assetId: transfer.assetId, returnedAt: null },
    });
    if (!currentActive || currentActive.id !== transfer.fromAllocationId) {
      throw ApiError.conflict(
        'TRANSFER_STALE',
        'The asset has changed hands since this request was made. Reject it and raise a fresh request.',
      );
    }

    const now = new Date();

    await tx.allocation.update({
      where: { id: currentActive.id },
      data: {
        returnedAt: now,
        status: 'RETURNED',
        returnNotes: `Transferred per request ${transfer.id}`,
      },
    });
    const newAllocation = await tx.allocation.create({
      data: {
        assetId: transfer.assetId,
        allocatedToUserId: transfer.requestedForUserId,
        allocatedToDepartmentId: transfer.requestedForDepartmentId,
        allocatedById: actor.id,
        allocatedAt: now,
      },
    });
    const updated = await tx.transferRequest.update({
      where: { id },
      data: { status: 'APPROVED', decidedById: actor.id, decidedAt: now, decisionNotes: notes },
      include: TRANSFER_INCLUDE,
    });

    const previousHolderId = transfer.fromAllocation.allocatedToUser?.id;
    const newHolderName =
      updated.requestedForUser?.name ?? updated.requestedForDepartment?.name ?? 'unknown';
    await notify(
      {
        userIds: [transfer.requestedById, previousHolderId ?? ''].filter(Boolean),
        type: 'TRANSFER_APPROVED',
        title: 'Transfer approved',
        body: `${updated.asset.name} (${updated.asset.assetTag}) has been transferred to ${newHolderName}.`,
        entityType: 'TransferRequest',
        entityId: id,
      },
      tx,
    );
    if (updated.requestedForUserId) {
      await notify(
        {
          userIds: [updated.requestedForUserId],
          type: 'ASSET_ASSIGNED',
          title: 'Asset assigned to you',
          body: `${updated.asset.name} (${updated.asset.assetTag}) has been transferred to you, approved by ${actor.name}.`,
          entityType: 'Allocation',
          entityId: newAllocation.id,
        },
        tx,
      );
    }
    await logActivity(
      {
        actorUserId: actor.id,
        action: 'transfer.approved',
        entityType: 'TransferRequest',
        entityId: id,
        metadata: { assetTag: updated.asset.assetTag, newHolder: newHolderName },
      },
      tx,
    );
    return updated;
  });
  return result;
}

export async function rejectTransfer(actor: Actor, id: string, notes?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const transfer = await tx.transferRequest.findUnique({ where: { id }, include: TRANSFER_INCLUDE });
    if (!transfer) throw ApiError.notFound('Transfer request not found.');
    assertActorMayDecide(actor, transfer);
    if (transfer.status !== 'REQUESTED') {
      throw ApiError.conflict(
        'TRANSFER_ALREADY_DECIDED',
        `This transfer request was already ${transfer.status.toLowerCase()}.`,
      );
    }
    const updated = await tx.transferRequest.update({
      where: { id },
      data: { status: 'REJECTED', decidedById: actor.id, decidedAt: new Date(), decisionNotes: notes },
      include: TRANSFER_INCLUDE,
    });
    await notify(
      {
        userIds: [transfer.requestedById],
        type: 'TRANSFER_REJECTED',
        title: 'Transfer request rejected',
        body: `Your transfer request for ${updated.asset.name} (${updated.asset.assetTag}) was rejected${notes ? `: ${notes}` : '.'}`,
        entityType: 'TransferRequest',
        entityId: id,
      },
      tx,
    );
    await logActivity(
      {
        actorUserId: actor.id,
        action: 'transfer.rejected',
        entityType: 'TransferRequest',
        entityId: id,
        metadata: { assetTag: updated.asset.assetTag, notes: notes ?? null },
      },
      tx,
    );
    return updated;
  });
  return result;
}

export async function listTransfers(
  actor: Actor,
  query: PaginationQuery & { status?: 'REQUESTED' | 'APPROVED' | 'REJECTED'; assetId?: string },
) {
  const where: Prisma.TransferRequestWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.assetId ? { assetId: query.assetId } : {}),
  };
  if (actor.role === 'EMPLOYEE') {
    where.OR = [{ requestedById: actor.id }, { requestedForUserId: actor.id }];
  } else if (actor.role === 'DEPARTMENT_HEAD' && actor.departmentId) {
    where.OR = [
      { requestedById: actor.id },
      { requestedForDepartmentId: actor.departmentId },
      { requestedForUser: { departmentId: actor.departmentId } },
      { fromAllocation: { allocatedToUser: { departmentId: actor.departmentId } } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.transferRequest.findMany({
      where,
      include: TRANSFER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.transferRequest.count({ where }),
  ]);
  return { data: rows, meta: buildMeta(query, total) };
}
