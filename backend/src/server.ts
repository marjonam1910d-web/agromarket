import http from 'node:http';
import { env } from './config/env';
import { createApp } from './app';
import { attachRealtime } from './lib/realtime';
import { prisma } from './lib/prisma';
import { closeRedis } from './lib/redis';
import { logger } from './lib/logger';
import { startJobs } from './jobs';

const app = createApp();
const server = http.createServer(app);
const rt = attachRealtime(server);
const stopJobs = startJobs();

server.keepAliveTimeout = 65_000; // Nginx keepalive bilan mos
server.listen(env.PORT, () => {
  logger.info(`AgroMarket API → http://localhost:${env.PORT}  (docs: /api/docs, ws: /ws, env: ${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  logger.info(`${signal}: to'xtatilmoqda...`);
  stopJobs();
  rt.close();
  server.close(async () => {
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (e) => logger.error('unhandledRejection', { err: String(e) }));
