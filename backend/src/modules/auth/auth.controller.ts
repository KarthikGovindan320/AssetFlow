import { Request, Response } from 'express';
import { parseBody } from '../../lib/validation';
import * as authService from './auth.service';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  signupSchema,
} from './auth.schemas';

export async function signup(req: Request, res: Response) {
  const input = parseBody(signupSchema, req);
  const result = await authService.signup(input);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const input = parseBody(loginSchema, req);
  const result = await authService.login(input);
  res.json(result);
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = parseBody(refreshSchema, req);
  const result = await authService.refresh(refreshToken);
  res.json(result);
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.user!.id);
  res.json({ message: 'Signed out.' });
}

export async function me(req: Request, res: Response) {
  const user = await authService.me(req.user!.id);
  res.json({ user });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = parseBody(forgotPasswordSchema, req);
  const result = await authService.forgotPassword(email);
  res.json(result);
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = parseBody(resetPasswordSchema, req);
  const result = await authService.resetPassword(token, newPassword);
  res.json(result);
}
