import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { requireAuth } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rate-limit';
import * as controller from './auth.controller';

export const authRouter = Router();

authRouter.post('/signup', authRateLimiter, asyncHandler(controller.signup));
authRouter.post('/login', authRateLimiter, asyncHandler(controller.login));
authRouter.post('/refresh', asyncHandler(controller.refresh));
authRouter.post('/forgot-password', authRateLimiter, asyncHandler(controller.forgotPassword));
authRouter.post('/reset-password', authRateLimiter, asyncHandler(controller.resetPassword));
authRouter.post('/logout', requireAuth, asyncHandler(controller.logout));
authRouter.get('/me', requireAuth, asyncHandler(controller.me));
