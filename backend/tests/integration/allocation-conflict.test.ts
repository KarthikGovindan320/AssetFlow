import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../src/lib/prisma';
import { app, managerLogin, uniqueEmail } from './helpers';

let manager: string;
let assetId = '';
let assetTag = '';
let userAId = '';
let userBId = '';
const emailA = uniqueEmail('holder');
const emailB = uniqueEmail('claimant');

beforeAll(async () => {
  manager = await managerLogin();
  const [a, b] = await Promise.all([
    request(app).post('/api/v1/auth/signup').send({ name: 'Holder Person', email: emailA, password: 'Str0ngPass!' }),
    request(app).post('/api/v1/auth/signup').send({ name: 'Claimant Person', email: emailB, password: 'Str0ngPass!' }),
  ]);
  userAId = a.body.user.id;
  userBId = b.body.user.id;
  const categories = await request(app).get('/api/v1/categories').set('Authorization', `Bearer ${manager}`);
  const furniture = categories.body.data.find((c: { name: string }) => c.name === 'Furniture');
  const created = await request(app)
    .post('/api/v1/assets')
    .set('Authorization', `Bearer ${manager}`)
    .send({
      name: 'Test Ergonomic Chair',
      categoryId: furniture.id,
      acquisitionDate: '2025-01-10',
      acquisitionCost: 12000,
      condition: 'GOOD',
      location: 'Test Lab',
    });
  expect(created.status).toBe(201);
  assetId = created.body.id;
  assetTag = created.body.assetTag;
});

afterAll(async () => {
  const allocations = await prisma.allocation.findMany({ where: { assetId }, select: { id: true } });
  const allocationIds = allocations.map((a) => a.id);
  await prisma.transferRequest.deleteMany({ where: { assetId } });
  await prisma.notification.deleteMany({ where: { user: { email: { in: [emailA, emailB] } } } });
  await prisma.allocation.deleteMany({ where: { assetId } });
  await prisma.activityLog.deleteMany({
    where: {
      OR: [
        { entityType: 'Asset', entityId: assetId },
        { entityType: 'Allocation', entityId: { in: allocationIds } },
        { actor: { email: { in: [emailA, emailB] } } },
      ],
    },
  });
  await prisma.asset.delete({ where: { id: assetId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  await prisma.$disconnect();
});

describe('allocation conflict → transfer → return', () => {
  it('allocates an AVAILABLE asset and flips its status', async () => {
    const res = await request(app)
      .post('/api/v1/allocations')
      .set('Authorization', `Bearer ${manager}`)
      .send({ assetId, allocatedToUserId: userAId });
    expect(res.status).toBe(201);
    expect(res.body.asset.status).toBe('ALLOCATED');
  });

  it('blocks a second allocation with the exact 409 conflict envelope', async () => {
    const res = await request(app)
      .post('/api/v1/allocations')
      .set('Authorization', `Bearer ${manager}`)
      .send({ assetId, allocatedToUserId: userBId });
    expect(res.status).toBe(409);
    const { code, message, details } = res.body.error;
    expect(code).toBe('ASSET_ALREADY_ALLOCATED');
    expect(message).toContain('currently held by Holder Person');
    expect(details.assetTag).toBe(assetTag);
    expect(details.currentHolder).toMatchObject({ type: 'USER', id: userAId, name: 'Holder Person' });
    expect(details.allocationId).toBeTruthy();
    expect(details.suggestedAction).toBe('TRANSFER_REQUEST');
  });

  it('approving a transfer re-allocates atomically and preserves history', async () => {
    const created = await request(app)
      .post('/api/v1/transfer-requests')
      .set('Authorization', `Bearer ${manager}`)
      .send({ assetId, requestedForUserId: userBId, reason: 'Integration test transfer' });
    expect(created.status).toBe(201);

    const approved = await request(app)
      .post(`/api/v1/transfer-requests/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${manager}`)
      .send({});
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');

    const history = await request(app)
      .get(`/api/v1/assets/${assetId}`)
      .set('Authorization', `Bearer ${manager}`);
    expect(history.body.status).toBe('ALLOCATED');
    expect(history.body.currentAllocation.holder.id).toBe(userBId);
    expect(history.body.allocations).toHaveLength(2);
  });

  it('returning the asset reverts it to AVAILABLE with condition check-in', async () => {
    const detail = await request(app)
      .get(`/api/v1/assets/${assetId}`)
      .set('Authorization', `Bearer ${manager}`);
    const res = await request(app)
      .post(`/api/v1/allocations/${detail.body.currentAllocation.id}/return`)
      .set('Authorization', `Bearer ${manager}`)
      .send({ condition: 'FAIR', notes: 'Scratched armrest' });
    expect(res.status).toBe(200);
    expect(res.body.asset.status).toBe('AVAILABLE');
    expect(res.body.returnCondition).toBe('FAIR');
  });
});
