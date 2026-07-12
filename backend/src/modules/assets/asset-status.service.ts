import { AssetStatus } from '@prisma/client';
import { Tx } from '../../lib/prisma';
import { ApiError } from '../../lib/http-error';
import { canTransition } from '../../lib/asset-status-machine';
import { logActivity } from '../activity/activity.service';

export async function transitionAssetStatus(
  tx: Tx,
  assetId: string,
  toStatus: AssetStatus,
  actorUserId: string,
  reason: string,
): Promise<void> {
  const asset = await tx.asset.findUnique({
    where: { id: assetId },
    select: { id: true, assetTag: true, status: true },
  });
  if (!asset) throw ApiError.notFound('Asset not found.');
  if (asset.status === toStatus) return;

  if (!canTransition(asset.status, toStatus)) {
    throw ApiError.conflict(
      'INVALID_STATUS_TRANSITION',
      `Asset ${asset.assetTag} cannot move from ${asset.status} to ${toStatus}.`,
      { from: asset.status, to: toStatus },
    );
  }

  await tx.asset.update({ where: { id: assetId }, data: { status: toStatus } });
  await logActivity(
    {
      actorUserId,
      action: 'asset.status_changed',
      entityType: 'Asset',
      entityId: assetId,
      metadata: { assetTag: asset.assetTag, from: asset.status, to: toStatus, reason },
    },
    tx,
  );
}
