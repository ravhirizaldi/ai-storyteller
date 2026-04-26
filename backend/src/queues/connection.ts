import { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../lib/logger';

let _connection: Redis | null = null;

/** Get singleton Redis connection for BullMQ */
export function getRedisConnection(): Redis {
  if (!_connection) {
    _connection = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      maxRetriesPerRequest: null, // Required by BullMQ
    });

    _connection.on('connect', () => logger.info('✅ Redis connected'));
    _connection.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  }
  return _connection;
}
