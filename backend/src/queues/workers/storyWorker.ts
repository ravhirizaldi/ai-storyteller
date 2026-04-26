import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedisConnection } from '../connection';
import { QUEUE_NAME, type ProcessMemoryJobData } from '../storyQueue';
import { createMemory, searchMemoriesByText } from '../../modules/memories/memoriesService';
import { updateStory } from '../../modules/stories/storiesService';
import { updateCharacter, getCharactersByStory } from '../../modules/characters/charactersService';
import { updatePlotThread, getActivePlotThreads } from '../../modules/plotThreads/plotThreadsService';
import { generateStructured } from '../../providers/grok/grokStructured';
import { logger } from '../../lib/logger';

/**
 * Background worker that processes story memory after each generation.
 * Responsibilities:
 *   1. Extract important facts and create memory entries
 *   2. Update current scene state
 *   3. Update character states
 *   4. Update plot thread progress
 */

interface MemoryExtractionResult {
  memories: Array<{
    type: string;
    content: string;
    importance: number;
  }>;
  sceneStateUpdate: string | null;
  characterUpdates: Array<{
    name: string;
    currentState: string;
  }>;
  plotThreadUpdates: Array<{
    title: string;
    progressNote: string;
    resolved: boolean;
  }>;
}

const MEMORY_SCHEMA = {
  type: 'object',
  properties: {
    memories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          content: { type: 'string' },
          importance: { type: 'integer' },
        },
        required: ['type', 'content', 'importance'],
        additionalProperties: false,
      },
    },
    sceneStateUpdate: { type: ['string', 'null'] },
    characterUpdates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          currentState: { type: 'string' },
        },
        required: ['name', 'currentState'],
        additionalProperties: false,
      },
    },
    plotThreadUpdates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          progressNote: { type: 'string' },
          resolved: { type: 'boolean' },
        },
        required: ['title', 'progressNote', 'resolved'],
        additionalProperties: false,
      },
    },
  },
  required: ['memories', 'sceneStateUpdate', 'characterUpdates', 'plotThreadUpdates'],
  additionalProperties: false,
};

const worker = new Worker<ProcessMemoryJobData>(
  QUEUE_NAME,
  async (job) => {
    const { storyId, userMessage, assistantMessage, userMessageId } = job.data;
    logger.info({ jobId: job.id, storyId }, 'Worker: job started');

    // Build analysis prompt
    const userPrompt = `Analyze the following story exchange and extract:
1. Important facts, events, and details as memories (max 5, only truly significant ones)
2. How the current scene state has changed (null if unchanged). Scene state must describe ONLY the current known situation. Do NOT update with future assumptions.
3. How each character's current state has changed (only those that changed)
4. Updates to plot threads (only those that progressed or resolved)

RULES FOR PLOT THREADS:
- ONLY create a new plot thread if the assistant response clearly introduces an unresolved conflict, promise, mystery, goal, or pending consequence.
- DO NOT create plot threads from minor atmosphere or casual dialogue.
- DO NOT mark plot threads resolved unless the scene clearly resolves them.

USER MESSAGE:
${userMessage}

ASSISTANT RESPONSE:
${assistantMessage}

Return structured JSON matching the schema.`;

    const systemPrompt = `You are a story continuity analyst. 
Extract only genuinely important information that affects long-term story continuity.
Be selective — only include information that would be important to remember later.
Respond in the same language as the story text above.`;

    try {
      const result = await generateStructured<MemoryExtractionResult>({
        systemPrompt,
        userPrompt,
        schema: MEMORY_SCHEMA,
        schemaName: 'StoryMemoryExtraction',
        temperature: 0.15,
      });

      // 1. Create memory entries
      for (const mem of result.memories) {
        if (mem.content && mem.content.trim()) {
          await createMemory({
            storyId,
            type: mem.type || 'fact',
            content: mem.content,
            importance: Math.min(Math.max(mem.importance || 1, 1), 5),
            sourceMessageId: userMessageId,
          });
        }
      }

      // 2. Update scene state if changed
      if (result.sceneStateUpdate && result.sceneStateUpdate.trim()) {
        await updateStory(storyId, { currentSceneState: result.sceneStateUpdate });
        logger.debug({ storyId }, 'Scene state updated');
      }

      // 3. Update character states
      if (result.characterUpdates.length > 0) {
        const characters = await getCharactersByStory(storyId);
        for (const update of result.characterUpdates) {
          const char = characters.find(
            (c) => c.name.toLowerCase() === update.name.toLowerCase(),
          );
          if (char && update.currentState) {
            await updateCharacter(char.id, { currentState: update.currentState });
          }
        }
      }

      // 4. Update plot threads
      if (result.plotThreadUpdates.length > 0) {
        const plotThreads = await getActivePlotThreads(storyId);
        for (const update of result.plotThreadUpdates) {
          const thread = plotThreads.find(
            (pt) => pt.title.toLowerCase().includes(update.title.toLowerCase()) ||
              update.title.toLowerCase().includes(pt.title.toLowerCase()),
          );
          if (thread) {
            await updatePlotThread(thread.id, {
              status: update.resolved ? 'resolved' : 'active',
              content: update.progressNote,
              lastSeenAt: new Date(),
            });
          }
        }
      }

      logger.info({ jobId: job.id, storyId, memoriesCreated: result.memories.length }, 'Worker: job completed');
    } catch (err) {
      logger.error({ err, jobId: job.id, storyId }, 'Worker: job failed');
      throw err;
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 3,
  },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Worker: job completed successfully');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Worker: job permanently failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Worker: unexpected error');
});

logger.info(`✅ Story worker started — listening on queue "${QUEUE_NAME}"`);
