import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "../connection";
import { QUEUE_NAME, type ProcessMemoryJobData } from "../storyQueue";
import {
  createMemory,
  searchMemoriesByText,
} from "../../modules/memories/memoriesService";
import { updateStory } from "../../modules/stories/storiesService";
import {
  updateCharacter,
  getCharactersByStory,
  createCharacter,
} from "../../modules/characters/charactersService";
import {
  updatePlotThread,
  getActivePlotThreads,
  createPlotThread,
  getPlotThreadsByStory,
} from "../../modules/plotThreads/plotThreadsService";
import { getStoryById } from "../../modules/stories/storiesService";
import { generateStructured } from "../../providers/grok/grokStructured";
import { logger } from "../../lib/logger";

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
    // Optional — only populated when the analyst thinks this is a newly
    // introduced named character that should be tracked going forward.
    isNew?: boolean;
    role?: string | null;
    description?: string | null;
    personality?: string | null;
  }>;
  plotThreadUpdates: Array<{
    title: string;
    progressNote: string;
    resolved: boolean;
    // Optional — true when the analyst believes this thread is newly
    // introduced and should be tracked going forward.
    isNew?: boolean;
  }>;
}

const MEMORY_SCHEMA = {
  type: "object",
  properties: {
    memories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          content: { type: "string" },
          importance: { type: "integer" },
        },
        required: ["type", "content", "importance"],
        additionalProperties: false,
      },
    },
    sceneStateUpdate: { type: ["string", "null"] },
    characterUpdates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          currentState: { type: "string" },
          isNew: { type: "boolean" },
          role: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          personality: { type: ["string", "null"] },
        },
        required: [
          "name",
          "currentState",
          "isNew",
          "role",
          "description",
          "personality",
        ],
        additionalProperties: false,
      },
    },
    plotThreadUpdates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          progressNote: { type: "string" },
          resolved: { type: "boolean" },
          isNew: { type: "boolean" },
        },
        required: ["title", "progressNote", "resolved", "isNew"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "memories",
    "sceneStateUpdate",
    "characterUpdates",
    "plotThreadUpdates",
  ],
  additionalProperties: false,
};

const worker = new Worker<ProcessMemoryJobData>(
  QUEUE_NAME,
  async (job) => {
    const { storyId, userMessage, assistantMessage, userMessageId } = job.data;
    logger.info({ jobId: job.id, storyId }, "Worker: job started");

    // Known entities so the analyst can decide what's already tracked.
    const [story, knownCharacters, knownPlotThreads] = await Promise.all([
      getStoryById(storyId),
      getCharactersByStory(storyId),
      getPlotThreadsByStory(storyId),
    ]);

    const knownCharBlock = knownCharacters.length
      ? knownCharacters
          .map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ""}`)
          .join("\n")
      : "(none yet)";
    const knownThreadBlock = knownPlotThreads.length
      ? knownPlotThreads.map((pt) => `- ${pt.title} [${pt.status}]`).join("\n")
      : "(none yet)";

    // Build analysis prompt
    const userPrompt = `Analyze the following story exchange and extract:
1. Important facts, events, and details as memories (max 5, only truly significant ones)
2. How the current scene state has changed (null if unchanged). Scene state must describe ONLY the current known situation. Do NOT update with future assumptions.
3. Character updates (existing or newly introduced).
4. Updates to plot threads (existing progress, resolutions, or newly introduced threads).

RULES FOR CHARACTERS:
- For every NAMED character who meaningfully appears, speaks, or acts in the exchange, emit one entry.
- Set isNew=true ONLY if the character is NOT in KNOWN CHARACTERS below AND has an actual name (not a nameless stranger, not a crowd, not a job title alone).
- For isNew=true, also fill role (e.g. "protagonist", "mentor", "antagonist", "sibling"), description (1-2 sentences grounded in the exchange only — no invented backstory), and personality (1 sentence based on observed behavior).
- For isNew=false, match the name exactly to KNOWN CHARACTERS and only update currentState.
- Do NOT emit entries for the player's own character unless the AI changed their state in a way worth recording.

RULES FOR PLOT THREADS:
- Set isNew=true ONLY when the assistant response introduces a NEW unresolved conflict, promise, mystery, goal, or pending consequence that is NOT already in KNOWN PLOT THREADS.
- Set isNew=false for updates to existing threads — match the title to an existing one.
- DO NOT create plot threads from minor atmosphere or casual dialogue.
- DO NOT mark plot threads resolved unless the scene clearly resolves them.

KNOWN CHARACTERS:
${knownCharBlock}

KNOWN PLOT THREADS:
${knownThreadBlock}

STORY LANGUAGE: ${story.language}

USER MESSAGE:
${userMessage}

ASSISTANT RESPONSE:
${assistantMessage}

Return structured JSON matching the schema. When role/description/personality don't apply (isNew=false), set them to null.`;

    const systemPrompt = `You are a story continuity analyst. 
Extract only genuinely important information that affects long-term story continuity.
Be selective — only include information that would be important to remember later.
Respond in the same language as the story text above.`;

    try {
      const result = await generateStructured<MemoryExtractionResult>({
        systemPrompt,
        userPrompt,
        schema: MEMORY_SCHEMA,
        schemaName: "StoryMemoryExtraction",
        temperature: 0.15,
      });

      // 1. Create memory entries
      for (const mem of result.memories) {
        if (mem.content && mem.content.trim()) {
          await createMemory({
            storyId,
            type: mem.type || "fact",
            content: mem.content,
            importance: Math.min(Math.max(mem.importance || 1, 1), 5),
            sourceMessageId: userMessageId,
          });
        }
      }

      // 2. Update scene state if changed
      if (result.sceneStateUpdate && result.sceneStateUpdate.trim()) {
        await updateStory(storyId, {
          currentSceneState: result.sceneStateUpdate,
        });
        logger.debug({ storyId }, "Scene state updated");
      }

      // 3. Character updates — update existing, auto-create new.
      let charactersCreated = 0;
      if (result.characterUpdates.length > 0) {
        // Start from the pre-fetched list, but append as we create new ones
        // so duplicates within the same batch collapse correctly.
        const knownByName = new Map(
          knownCharacters.map((c) => [c.name.toLowerCase(), c]),
        );
        for (const update of result.characterUpdates) {
          if (!update.name || !update.name.trim()) continue;
          const key = update.name.trim().toLowerCase();
          const existing = knownByName.get(key);
          if (existing) {
            if (update.currentState) {
              await updateCharacter(existing.id, {
                currentState: update.currentState,
              });
            }
            continue;
          }
          // New character — create only if the analyst flagged it as new and
          // supplied at least a description. Guard against obviously generic
          // names ('narrator', 'stranger', 'user', single-character tokens).
          if (!update.isNew) continue;
          const bad = /^(narrator|stranger|someone|user|player|you|me|i)$/i;
          if (bad.test(update.name.trim()) || update.name.trim().length < 2) {
            continue;
          }
          const created = await createCharacter({
            storyId,
            name: update.name.trim(),
            role: update.role?.trim() || undefined,
            description: update.description?.trim() || undefined,
            personality: update.personality?.trim() || undefined,
            currentState: update.currentState?.trim() || undefined,
          });
          knownByName.set(key, created);
          charactersCreated++;
        }
      }

      // 4. Plot thread updates — update existing, auto-create new.
      let plotThreadsCreated = 0;
      if (result.plotThreadUpdates.length > 0) {
        const activeThreads = await getActivePlotThreads(storyId);
        for (const update of result.plotThreadUpdates) {
          if (!update.title || !update.title.trim()) continue;
          const needle = update.title.trim().toLowerCase();
          const thread = activeThreads.find(
            (pt) =>
              pt.title.toLowerCase().includes(needle) ||
              needle.includes(pt.title.toLowerCase()),
          );
          if (thread) {
            await updatePlotThread(thread.id, {
              status: update.resolved ? "resolved" : "active",
              content: update.progressNote,
              lastSeenAt: new Date(),
            });
            continue;
          }
          if (!update.isNew || update.resolved) continue;
          await createPlotThread({
            storyId,
            title: update.title.trim(),
            content: update.progressNote?.trim() || undefined,
            status: "active",
          });
          plotThreadsCreated++;
        }
      }

      logger.info(
        {
          jobId: job.id,
          storyId,
          memoriesCreated: result.memories.length,
          charactersCreated,
          plotThreadsCreated,
        },
        "Worker: job completed",
      );
    } catch (err) {
      logger.error({ err, jobId: job.id, storyId }, "Worker: job failed");
      throw err;
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 3,
  },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Worker: job completed successfully");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Worker: job permanently failed");
});

worker.on("error", (err) => {
  logger.error({ err }, "Worker: unexpected error");
});

logger.info(`✅ Story worker started — listening on queue "${QUEUE_NAME}"`);
