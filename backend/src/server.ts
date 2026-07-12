import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { startScheduler, stopScheduler } from './modules/notifications/scheduler';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`AssetFlow API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  startScheduler();
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down…`);
  stopScheduler();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
