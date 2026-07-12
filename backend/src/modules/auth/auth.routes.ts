import { Request, Response, Router } from 'express';

export const authRouter = Router();

function notImplemented(_req: Request, res: Response) {
  res.status(501).json({
    error: { code: 'NOT_IMPLEMENTED', message: 'This endpoint is not available yet.' },
  });
}

authRouter.post('/signup', notImplemented);
authRouter.post('/login', notImplemented);
authRouter.post('/refresh', notImplemented);
authRouter.post('/logout', notImplemented);
authRouter.get('/me', notImplemented);
