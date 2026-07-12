import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../src/lib/prisma';
import { app, adminLogin, uniqueEmail } from './helpers';

const email = uniqueEmail('auth');
const createdEmails = [email];

afterAll(async () => {
  await prisma.activityLog.deleteMany({ where: { actor: { email: { in: createdEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe('auth & RBAC', () => {
  it('signup creates an EMPLOYEE and ignores any role escalation attempt', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'Test User', email, password: 'Str0ngPass!', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('EMPLOYEE');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('rejects an invalid email with a field-level message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'Bad Email', email: 'not-an-email', password: 'Str0ngPass!' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields.email).toBe('Entered email is invalid');
  });

  it('rejects wrong credentials with 401 and no account probing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('blocks an EMPLOYEE from admin-only routes at the API level', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Str0ngPass!' });
    const token = login.body.accessToken;
    const res = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rogue Department' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('blocks an EMPLOYEE from changing roles (no self-promotion path)', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Str0ngPass!' });
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    const res = await request(app)
      .post(`/api/v1/employees/${me.body.user.id}/role`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('lets an Admin promote the employee via the directory (the only role path)', async () => {
    const adminToken = await adminLogin();
    const list = await request(app)
      .get(`/api/v1/employees?q=${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const target = list.body.data[0];
    const res = await request(app)
      .post(`/api/v1/employees/${target.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'DEPARTMENT_HEAD' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('DEPARTMENT_HEAD');
  });

  it('validates a session via /auth/me and refreshes with rotation', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Str0ngPass!' });
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    const refresh1 = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(refresh1.status).toBe(200);

    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(replay.status).toBe(401);
  });
});
