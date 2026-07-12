import { AssetStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/http-error';
import { buildMeta, PaginationQuery, toSkipTake } from '../../lib/pagination';
import { logActivity } from '../activity/activity.service';
import { CustomFieldDef } from '../categories/category.schemas';
import { transitionAssetStatus } from './asset-status.service';

const ASSET_INCLUDE = {
  category: { select: { id: true, name: true, customFields: true } },
  allocations: {
    where: { returnedAt: null },
    include: {
      allocatedToUser: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
      allocatedToDepartment: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AssetInclude;

function present<T extends { allocations: any[] }>(asset: T) {
  const active = asset.allocations[0] ?? null;
  const { allocations, ...rest } = asset;
  return {
    ...rest,
    currentAllocation: active
      ? {
          id: active.id,
          allocatedAt: active.allocatedAt,
          expectedReturnDate: active.expectedReturnDate,
          holder: active.allocatedToUser
            ? { type: 'USER' as const, id: active.allocatedToUser.id, name: active.allocatedToUser.name }
            : { type: 'DEPARTMENT' as const, id: active.allocatedToDepartment!.id, name: active.allocatedToDepartment!.name },
        }
      : null,
  };
}

export function validateCustomFieldValues(
  defs: CustomFieldDef[],
  values: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const input = values ?? {};
  const fields: Record<string, string> = {};
  const known = new Set(defs.map((d) => d.key));
  for (const key of Object.keys(input)) {
    if (!known.has(key)) fields[`customFieldValues.${key}`] = 'Unknown field for this category';
  }
  const normalized: Record<string, unknown> = {};
  for (const def of defs) {
    const raw = input[def.key];
    const empty = raw === undefined || raw === null || raw === '';
    if (empty) {
      if (def.required) fields[`customFieldValues.${def.key}`] = `${def.label} is required`;
      continue;
    }
    if (def.type === 'number') {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) {
        fields[`customFieldValues.${def.key}`] = `${def.label} must be a number`;
        continue;
      }
      normalized[def.key] = n;
    } else if (def.type === 'date') {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) {
        fields[`customFieldValues.${def.key}`] = `${def.label} must be a valid date`;
        continue;
      }
      normalized[def.key] = d.toISOString();
    } else {
      normalized[def.key] = String(raw);
    }
  }
  if (Object.keys(fields).length > 0) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', { fields });
  }
  return normalized;
}

async function nextAssetTag(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('asset_tag_seq')`;
  return `AF-${String(rows[0].nextval).padStart(4, '0')}`;
}

export async function createAsset(
  actorId: string,
  input: {
    name: string;
    categoryId: string;
    serialNumber?: string | null;
    acquisitionDate: Date;
    acquisitionCost: number;
    condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
    location: string;
    isBookable: boolean;
    customFieldValues?: Record<string, unknown>;
    photoUrl?: string | null;
    expectedRetirementDate?: Date | null;
  },
) {
  const category = await prisma.assetCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
      fields: { categoryId: 'Selected category does not exist' },
    });
  }
  if (input.serialNumber) {
    const clash = await prisma.asset.findUnique({ where: { serialNumber: input.serialNumber } });
    if (clash) {
      throw ApiError.conflict(
        'SERIAL_NUMBER_TAKEN',
        `Serial number ${input.serialNumber} is already registered to asset ${clash.assetTag}.`,
        { fields: { serialNumber: 'This serial number is already registered' } },
      );
    }
  }
  const customFieldValues = validateCustomFieldValues(
    (category.customFields as unknown as CustomFieldDef[]) ?? [],
    input.customFieldValues,
  );

  const asset = await prisma.$transaction(async (tx) => {
    const assetTag = await nextAssetTag(tx);
    const created = await tx.asset.create({
      data: {
        assetTag,
        name: input.name,
        categoryId: input.categoryId,
        serialNumber: input.serialNumber ?? null,
        acquisitionDate: input.acquisitionDate,
        acquisitionCost: new Prisma.Decimal(input.acquisitionCost),
        condition: input.condition,
        location: input.location,
        isBookable: input.isBookable,
        customFieldValues: customFieldValues as Prisma.InputJsonValue,
        photoUrl: input.photoUrl ?? null,
        expectedRetirementDate: input.expectedRetirementDate ?? null,
      },
      include: ASSET_INCLUDE,
    });
    await logActivity(
      {
        actorUserId: actorId,
        action: 'asset.registered',
        entityType: 'Asset',
        entityId: created.id,
        metadata: { assetTag: created.assetTag, name: created.name },
      },
      tx,
    );
    return created;
  });
  return present(asset);
}

export async function listAssets(
  query: PaginationQuery & {
    q?: string;
    categoryId?: string;
    status?: AssetStatus;
    location?: string;
    departmentId?: string;
    isBookable?: boolean;
  },
) {
  const where: Prisma.AssetWhereInput = {
    ...(query.q
      ? {
          OR: [
            { assetTag: { contains: query.q, mode: 'insensitive' } },
            { serialNumber: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.location ? { location: { contains: query.location, mode: 'insensitive' } } : {}),
    ...(query.isBookable !== undefined ? { isBookable: query.isBookable } : {}),
    ...(query.departmentId
      ? {
          allocations: {
            some: {
              returnedAt: null,
              OR: [
                { allocatedToDepartmentId: query.departmentId },
                { allocatedToUser: { departmentId: query.departmentId } },
              ],
            },
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: ASSET_INCLUDE,
      orderBy: { assetTag: 'asc' },
      ...toSkipTake(query),
    }),
    prisma.asset.count({ where }),
  ]);
  return { data: rows.map(present), meta: buildMeta(query, total) };
}

export async function listLocations() {
  const rows = await prisma.asset.findMany({
    distinct: ['location'],
    select: { location: true },
    orderBy: { location: 'asc' },
  });
  return rows.map((r) => r.location);
}

export async function getAsset(id: string) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, customFields: true } },
      allocations: {
        include: {
          allocatedToUser: { select: { id: true, name: true } },
          allocatedToDepartment: { select: { id: true, name: true } },
          allocatedBy: { select: { id: true, name: true } },
        },
        orderBy: { allocatedAt: 'desc' },
      },
      maintenanceRequests: {
        include: {
          raisedBy: { select: { id: true, name: true } },
          decidedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!asset) throw ApiError.notFound('Asset not found.');
  const active = asset.allocations.find((a) => !a.returnedAt) ?? null;
  return {
    ...asset,
    currentAllocation: active
      ? {
          id: active.id,
          allocatedAt: active.allocatedAt,
          expectedReturnDate: active.expectedReturnDate,
          holder: active.allocatedToUser
            ? { type: 'USER' as const, id: active.allocatedToUser.id, name: active.allocatedToUser.name }
            : {
                type: 'DEPARTMENT' as const,
                id: active.allocatedToDepartment!.id,
                name: active.allocatedToDepartment!.name,
              },
        }
      : null,
  };
}

export async function updateAsset(
  actorId: string,
  id: string,
  input: Partial<Parameters<typeof createAsset>[1]>,
) {
  const asset = await prisma.asset.findUnique({ where: { id }, include: { category: true } });
  if (!asset) throw ApiError.notFound('Asset not found.');

  if (input.serialNumber && input.serialNumber !== asset.serialNumber) {
    const clash = await prisma.asset.findUnique({ where: { serialNumber: input.serialNumber } });
    if (clash) {
      throw ApiError.conflict(
        'SERIAL_NUMBER_TAKEN',
        `Serial number ${input.serialNumber} is already registered to asset ${clash.assetTag}.`,
        { fields: { serialNumber: 'This serial number is already registered' } },
      );
    }
  }

  let categoryForValidation = asset.category;
  if (input.categoryId && input.categoryId !== asset.categoryId) {
    const category = await prisma.assetCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Invalid request body', {
        fields: { categoryId: 'Selected category does not exist' },
      });
    }
    categoryForValidation = category;
  }

  let customFieldValues: Record<string, unknown> | undefined;
  if (input.customFieldValues !== undefined || input.categoryId) {
    customFieldValues = validateCustomFieldValues(
      (categoryForValidation.customFields as unknown as CustomFieldDef[]) ?? [],
      input.customFieldValues ??
        ((asset.customFieldValues as Record<string, unknown> | null) ?? undefined),
    );
  }

  const updated = await prisma.asset.update({
    where: { id },
    data: {
      name: input.name,
      categoryId: input.categoryId,
      serialNumber: input.serialNumber,
      acquisitionDate: input.acquisitionDate,
      ...(input.acquisitionCost !== undefined
        ? { acquisitionCost: new Prisma.Decimal(input.acquisitionCost) }
        : {}),
      condition: input.condition,
      location: input.location,
      isBookable: input.isBookable,
      ...(customFieldValues !== undefined
        ? { customFieldValues: customFieldValues as Prisma.InputJsonValue }
        : {}),
      photoUrl: input.photoUrl,
      expectedRetirementDate: input.expectedRetirementDate,
    },
    include: ASSET_INCLUDE,
  });
  await logActivity({
    actorUserId: actorId,
    action: 'asset.updated',
    entityType: 'Asset',
    entityId: id,
    metadata: { assetTag: updated.assetTag },
  });
  return present(updated);
}

export async function setAssetStatus(
  actorId: string,
  id: string,
  status: AssetStatus,
  reason?: string,
) {
  await prisma.$transaction(async (tx) => {

    await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${id} FOR UPDATE`;
    if (status !== 'AVAILABLE') {
      const activeAllocation = await tx.allocation.findFirst({
        where: { assetId: id, returnedAt: null },
      });
      if (activeAllocation) {
        throw ApiError.conflict(
          'ASSET_HAS_ACTIVE_ALLOCATION',
          'This asset has an active allocation. Process a return before changing its status.',
        );
      }
    }
    await transitionAssetStatus(tx, id, status, actorId, reason ?? 'Manual status change');
  });
  return getAsset(id);
}
