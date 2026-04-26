import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './client';
import { logger } from '../lib/logger';

/**
 * Database migration/init script.
 * Run with: pnpm db:init
 * This is idempotent — safe to run multiple times.
 */
async function migrate(): Promise<void> {
  logger.info('Running database initialization...');

  const sqlPath = join(__dirname, 'sql', 'init.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    logger.info('✅ Database initialized successfully');
  } catch (err) {
    logger.error({ err }, '❌ Database initialization failed');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  logger.error({ err }, 'Migration script failed');
  process.exit(1);
});
