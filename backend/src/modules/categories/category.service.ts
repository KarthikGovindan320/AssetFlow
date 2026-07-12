import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/http-error';
import { logActivity } from '../activity/activity.service';
import { CustomFieldDef } from './category.schemas';

const CATEGORY_INCLUDE = {
  _count: { select: { assets: true } },
} satisfies Prisma.AssetCategoryInclude;

export async function listCategories() {
  const data = await prisma.assetCategory.findMany({
    include: CATEGORY_INCLUDE,
    orderBy: { name: 'asc' },
  });
  return { data };
}

export async function getCategory(id: string) {
  const category = await prisma.assetCategory.findUnique({ where: { id }, include: CATEGORY_INCLUDE });
  if (!category) throw ApiError.notFound('Asset category not found.');
  return category;
}

export async function createCategory(
  actorId: string,
  input: { name: string; description?: string; customFields: CustomFieldDef[] },
) {
  const existing = await prisma.assetCategory.findUnique({ where: { name: input.name } });
  if (existing) {
    throw ApiError.conflict('CATEGORY_NAME_TAKEN', `A category named "${input.name}" already exists.`, {
      fields: { name: 'A category with this name already exists' },
    });
  }
  const category = await prisma.assetCategory.create({
    data: {
      name: input.name,
      description: input.description,
      customFields: input.customFields as unknown as Prisma.InputJsonValue,
    },
    include: CATEGORY_INCLUDE,
  });
  await logActivity({
    actorUserId: actorId,
    action: 'category.created',
    entityType: 'AssetCategory',
    entityId: category.id,
    metadata: { name: category.name },
  });
  return category;
}

export async function updateCategory(
  actorId: string,
  id: string,
  input: { name?: string; description?: string; customFields?: CustomFieldDef[] },
) {
  const category = await prisma.assetCategory.findUnique({ where: { id } });
  if (!category) throw ApiError.notFound('Asset category not found.');
  if (input.name && input.name !== category.name) {
    const clash = await prisma.assetCategory.findUnique({ where: { name: input.name } });
    if (clash) {
      throw ApiError.conflict('CATEGORY_NAME_TAKEN', `A category named "${input.name}" already exists.`, {
        fields: { name: 'A category with this name already exists' },
      });
    }
  }
  const updated = await prisma.assetCategory.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      ...(input.customFields !== undefined
        ? { customFields: input.customFields as unknown as Prisma.InputJsonValue }
        : {}),
    },
    include: CATEGORY_INCLUDE,
  });
  await logActivity({
    actorUserId: actorId,
    action: 'category.updated',
    entityType: 'AssetCategory',
    entityId: id,
    metadata: { name: updated.name },
  });
  return updated;
}

export async function deleteCategory(actorId: string, id: string) {
  const category = await prisma.assetCategory.findUnique({
    where: { id },
    include: { _count: { select: { assets: true } } },
  });
  if (!category) throw ApiError.notFound('Asset category not found.');
  if (category._count.assets > 0) {
    throw ApiError.conflict(
      'CATEGORY_IN_USE',
      `Cannot delete "${category.name}": ${category._count.assets} asset(s) belong to it.`,
    );
  }
  await prisma.assetCategory.delete({ where: { id } });
  await logActivity({
    actorUserId: actorId,
    action: 'category.deleted',
    entityType: 'AssetCategory',
    entityId: id,
    metadata: { name: category.name },
  });
  return { message: `Category "${category.name}" deleted.` };
}
