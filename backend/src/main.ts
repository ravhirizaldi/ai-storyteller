import { buildApp } from './app';
import { connectDB } from './db/client';
import { getRedisConnection } from './queues/connection';
import { env } from './config/env';
import { logger } from './lib/logger';

async function main() {
  logger.info('Starting AI Storyteller Backend...');

  // 1. Connect to PostgreSQL
  await connectDB();

  // 2. Connect to Redis (triggers connect log via event)
  getRedisConnection();

  // 3. Build and start server
  const app = await buildApp();

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`🚀 Server running at http://localhost:${env.PORT}`);
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
