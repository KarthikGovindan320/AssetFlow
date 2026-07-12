import { describe, expect, it } from 'vitest';
import { AssetStatus } from '@prisma/client';
import { ASSET_STATUS_TRANSITIONS, canTransition } from '../src/lib/asset-status-machine';

describe('asset status state machine', () => {
  it('covers every status exactly once', () => {
    const statuses = Object.keys(ASSET_STATUS_TRANSITIONS).sort();
    expect(statuses).toEqual(
      ['AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED'].sort(),
    );
  });

  it('allows the workflow-critical transitions', () => {
    expect(canTransition('AVAILABLE', 'ALLOCATED')).toBe(true); 
    expect(canTransition('ALLOCATED', 'AVAILABLE')).toBe(true); 
    expect(canTransition('AVAILABLE', 'UNDER_MAINTENANCE')).toBe(true); 
    expect(canTransition('ALLOCATED', 'UNDER_MAINTENANCE')).toBe(true); 
    expect(canTransition('UNDER_MAINTENANCE', 'AVAILABLE')).toBe(true); 
    expect(canTransition('UNDER_MAINTENANCE', 'ALLOCATED')).toBe(true); 
    expect(canTransition('ALLOCATED', 'LOST')).toBe(true); 
    expect(canTransition('LOST', 'AVAILABLE')).toBe(true); 
    expect(canTransition('RESERVED', 'ALLOCATED')).toBe(true);
    expect(canTransition('RETIRED', 'DISPOSED')).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(canTransition('DISPOSED', 'AVAILABLE')).toBe(false); 
    expect(canTransition('RETIRED', 'ALLOCATED')).toBe(false);
    expect(canTransition('LOST', 'ALLOCATED')).toBe(false);
    expect(canTransition('AVAILABLE', 'AVAILABLE')).toBe(false); 
    expect(canTransition('ALLOCATED', 'RESERVED')).toBe(false);
    expect(canTransition('UNDER_MAINTENANCE', 'LOST')).toBe(false);
  });

  it('makes DISPOSED terminal', () => {
    const targets = ASSET_STATUS_TRANSITIONS.DISPOSED;
    expect(targets).toHaveLength(0);
    for (const from of Object.keys(ASSET_STATUS_TRANSITIONS) as AssetStatus[]) {

      if (from === 'DISPOSED') continue;
    }
  });
});
