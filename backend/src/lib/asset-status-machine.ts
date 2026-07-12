import { AssetStatus } from '@prisma/client';

export const ASSET_STATUS_TRANSITIONS: Readonly<Record<AssetStatus, readonly AssetStatus[]>> = {
  AVAILABLE: ['ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED'],
  ALLOCATED: ['AVAILABLE', 'UNDER_MAINTENANCE', 'LOST'],
  RESERVED: ['AVAILABLE', 'ALLOCATED'],

  UNDER_MAINTENANCE: ['AVAILABLE', 'ALLOCATED', 'RETIRED', 'DISPOSED'],
  LOST: ['AVAILABLE', 'DISPOSED'],
  RETIRED: ['DISPOSED'],
  DISPOSED: [],
};

export function canTransition(from: AssetStatus, to: AssetStatus): boolean {
  return ASSET_STATUS_TRANSITIONS[from].includes(to);
}

export function assertValidStatus(value: string): asserts value is AssetStatus {
  if (!(value in ASSET_STATUS_TRANSITIONS)) {
    throw new Error(`Unknown asset status: ${value}`);
  }
}
