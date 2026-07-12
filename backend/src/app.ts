import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authRouter } from './modules/auth/auth.routes';
import { departmentRouter } from './modules/departments/department.routes';
import { employeeRouter } from './modules/employees/employee.routes';
import { categoryRouter } from './modules/categories/category.routes';
import { assetRouter } from './modules/assets/asset.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV === 'development') app.use(requestLogger);

  app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/departments', departmentRouter);
  app.use('/api/v1/employees', employeeRouter);
  app.use('/api/v1/categories', categoryRouter);
  app.use('/api/v1/assets', assetRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });
  app.use(errorHandler);

  return app;
}
