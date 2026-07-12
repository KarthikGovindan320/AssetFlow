import request from 'supertest';
import { createApp } from '../../src/app';

export const app = createApp();

export async function loginAs(email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login as ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken as string;
}

export const adminLogin = () => loginAs('admin@assetflow.io', 'Admin@123');
export const managerLogin = () => loginAs('meera@assetflow.io', 'Demo@123');

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.assetflow.io`;
}
