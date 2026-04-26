import { Queue } from 'bullmq';
import { getRedisConnection } from './connection';
import { logger } from '../lib/logger';

export const QUEUE_NAME = 'story-jobs';

export type JobType = 'process-story-memory';

export interface ProcessMemoryJobData {
  storyId: string;
  userMessage: string;
  assistantMessage: string;
  userMessageId: string;
}

let _queue: Queue<ProcessMemoryJobData> | null = null;

function getQueue(): Queue<ProcessMemoryJobData> {
  if (!_queue) {
    _queue = new Queue<ProcessMemoryJobData>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return _queue;
}

/** Add a memory processing job to the queue */
export async function addProcessMemoryJob(data: ProcessMemoryJobData): Promise<void> {
  const queue = getQueue();
  const job = await queue.add('process-story-memory', data, {
    priority: 5,
  });
  logger.info({ jobId: job.id, storyId: data.storyId }, 'Job added: process-story-memory');
}

export { getQueue };
