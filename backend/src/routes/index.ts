import type { FastifyInstance } from "fastify";
import { z } from "zod";

import * as storiesService from "../modules/stories/storiesService";
import * as messagesService from "../modules/messages/messagesService";
import * as charactersService from "../modules/characters/charactersService";
import * as memoriesService from "../modules/memories/memoriesService";
import * as plotThreadsService from "../modules/plotThreads/plotThreadsService";
import {
  generateStoryStream,
  generateStoryText,
} from "../modules/generation/generationService";
import { generateImage } from "../providers/grok/grokImage";
import { addProcessMemoryJob } from "../queues/storyQueue";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

/** Helper to send typed validation errors */
function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(
      `Validation error: ${result.error.errors.map((e) => e.message).join(", ")}`,
      400,
      "VALIDATION_ERROR",
    );
  }
  return result.data;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────────────────────────────────────
  // HEALTH
  // ─────────────────────────────────────────────
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  // ─────────────────────────────────────────────
  // STORIES
  // ─────────────────────────────────────────────
  app.get("/api/stories", async () => storiesService.getAllStories());

  app.post("/api/stories", async (req, reply) => {
    const body = validateBody(
      z.object({
        title: z.string().min(1),
        genre: z.string().optional(),
        language: z.string().optional(),
        systemPrompt: z.string().optional(),
        stylePrompt: z.string().optional(),
        storyBible: z.string().optional(),
        currentSceneState: z.string().optional(),
        currentTimelineState: z.string().optional(),
        generationMode: z.string().optional(),
        temperature: z.number().optional(),
        maxOutputTokens: z.number().optional(),
        sceneLock: z.boolean().optional(),
        allowTimeSkip: z.boolean().optional(),
        allowLocationChange: z.boolean().optional(),
        allowMajorPlotProgress: z.boolean().optional(),
      }),
      req.body,
    );
    const story = await storiesService.createStory(body);
    return reply.status(201).send(story);
  });

  app.get("/api/stories/:storyId", async (req) => {
    const { storyId } = req.params as { storyId: string };
    return storiesService.getStoryById(storyId);
  });

  app.patch("/api/stories/:storyId", async (req) => {
    const { storyId } = req.params as { storyId: string };
    const body = validateBody(
      z.object({
        title: z.string().optional(),
        genre: z.string().optional(),
        language: z.string().optional(),
        systemPrompt: z.string().optional(),
        stylePrompt: z.string().optional(),
        storyBible: z.string().optional(),
        currentSceneState: z.string().optional(),
        currentTimelineState: z.string().optional(),
        generationMode: z.string().optional(),
        temperature: z.number().optional(),
        maxOutputTokens: z.number().optional(),
        sceneLock: z.boolean().optional(),
        allowTimeSkip: z.boolean().optional(),
        allowLocationChange: z.boolean().optional(),
        allowMajorPlotProgress: z.boolean().optional(),
      }),
      req.body,
    );
    return storiesService.updateStory(storyId, body);
  });

  app.delete("/api/stories/:storyId", async (req, reply) => {
    const { storyId } = req.params as { storyId: string };
    await storiesService.deleteStory(storyId);
    return reply.status(204).send();
  });

  app.post("/api/stories/:storyId/reset", async (req, reply) => {
    const { storyId } = req.params as { storyId: string };
    await storiesService.resetStoryProgress(storyId);
    return reply.status(200).send({ success: true });
  });

  // ─────────────────────────────────────────────
  // MESSAGES
  // ─────────────────────────────────────────────
  app.get("/api/stories/:storyId/messages", async (req) => {
    const { storyId } = req.params as { storyId: string };
    const { cursor } = req.query as { cursor?: string };
    return messagesService.getMessagesByStory(storyId, 10, cursor);
  });

  app.post("/api/stories/:storyId/messages", async (req, reply) => {
    const { storyId } = req.params as { storyId: string };
    const body = validateBody(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1),
      }),
      req.body,
    );
    const msg = await messagesService.createMessage({ storyId, ...body });
    return reply.status(201).send(msg);
  });

  /**
   * Delete the trailing user+assistant exchange for a story. Used by the
   * "Regenerate" flow so we don't pile up duplicate turns in the DB.
   */
  app.delete("/api/stories/:storyId/messages/last-exchange", async (req) => {
    const { storyId } = req.params as { storyId: string };
    await storiesService.getStoryById(storyId); // 404 if story missing
    return messagesService.deleteLastExchange(storyId);
  });

  /**
   * Edit a single message's content in place. Used by the in-bubble
   * "Edit" button in the writer UI.
   */
  app.patch(
    "/api/stories/:storyId/messages/:messageId",
    async (req, reply) => {
      const { storyId, messageId } = req.params as {
        storyId: string;
        messageId: string;
      };
      const body = validateBody(
        z.object({ content: z.string().min(1) }),
        req.body,
      );
      await storiesService.getStoryById(storyId);
      const existing = await messagesService.getMessageById(messageId);
      if (existing.story_id !== storyId) {
        return reply.status(404).send({ error: "Message not found in story" });
      }
      const updated = await messagesService.updateMessageContent(
        messageId,
        body.content,
      );
      return updated;
    },
  );

  /**
   * Delete a single turn — if the message is a user prompt, its paired
   * assistant reply is removed too. If the message is an assistant reply,
   * only that single row is removed.
   */
  app.delete(
    "/api/stories/:storyId/messages/:messageId",
    async (req, reply) => {
      const { storyId, messageId } = req.params as {
        storyId: string;
        messageId: string;
      };
      await storiesService.getStoryById(storyId);
      const existing = await messagesService.getMessageById(messageId);
      if (existing.story_id !== storyId) {
        return reply.status(404).send({ error: "Message not found in story" });
      }
      return messagesService.deleteTurnStartingAt(storyId, messageId);
    },
  );

  // ─────────────────────────────────────────────
  // GENERATION (non-streaming)
  // ─────────────────────────────────────────────
  app.post("/api/stories/:storyId/generate", async (req) => {
    const { storyId } = req.params as { storyId: string };
    const body = validateBody(
      z.object({
        message: z.string().min(1),
        generationOverride: z
          .object({
            mode: z.string().optional(),
            temperature: z.number().optional(),
            maxOutputTokens: z.number().optional(),
            sceneLock: z.boolean().optional(),
            allowTimeSkip: z.boolean().optional(),
            allowLocationChange: z.boolean().optional(),
            allowMajorPlotProgress: z.boolean().optional(),
          })
          .optional(),
      }),
      req.body,
    );
    return generateStoryText({
      storyId,
      userMessage: body.message,
      generationOverride: body.generationOverride,
    });
  });

  // ─────────────────────────────────────────────
  // GENERATION (streaming SSE)
  // ─────────────────────────────────────────────
  app.post("/api/stories/:storyId/generate/stream", async (req, reply) => {
    const { storyId } = req.params as { storyId: string };
    const body = validateBody(
      z.object({
        message: z.string().min(1),
        generationOverride: z
          .object({
            mode: z.string().optional(),
            temperature: z.number().optional(),
            maxOutputTokens: z.number().optional(),
            sceneLock: z.boolean().optional(),
            allowTimeSkip: z.boolean().optional(),
            allowLocationChange: z.boolean().optional(),
            allowMajorPlotProgress: z.boolean().optional(),
          })
          .optional(),
      }),
      req.body,
    );
    // streamText manages reply lifecycle directly
    await generateStoryStream(
      {
        storyId,
        userMessage: body.message,
        generationOverride: body.generationOverride,
      },
      reply,
    );
  });

  // ─────────────────────────────────────────────
  // CHARACTERS
  // ─────────────────────────────────────────────
  app.get("/api/stories/:storyId/characters", async (req) => {
    const { storyId } = req.params as { storyId: string };
    return charactersService.getCharactersByStory(storyId);
  });

  app.post("/api/stories/:storyId/characters", async (req, reply) => {
    const { storyId } = req.params as { storyId: string };
    const body = validateBody(
      z.object({
        name: z.string().min(1),
        role: z.string().optional(),
        description: z.string().optional(),
        personality: z.string().optional(),
        relationshipNotes: z.string().optional(),
        currentState: z.string().optional(),
      }),
      req.body,
    );
    const ch = await charactersService.createCharacter({ storyId, ...body });
    return reply.status(201).send(ch);
  });

  app.patch("/api/characters/:characterId", async (req) => {
    const { characterId } = req.params as { characterId: string };
    const body = validateBody(
      z.object({
        name: z.string().optional(),
        role: z.string().optional(),
        description: z.string().optional(),
        personality: z.string().optional(),
        relationshipNotes: z.string().optional(),
        currentState: z.string().optional(),
      }),
      req.body,
    );
    return charactersService.updateCharacter(characterId, body);
  });

  app.delete("/api/characters/:characterId", async (req, reply) => {
    const { characterId } = req.params as { characterId: string };
    await charactersService.deleteCharacter(characterId);
    return reply.status(204).send();
  });

  // ─────────────────────────────────────────────
  // MEMORIES
  // ─────────────────────────────────────────────
  app.get("/api/stories/:storyId/memories", async (req) => {
    const { storyId } = req.params as { storyId: string };
    return memoriesService.getMemoriesByStory(storyId);
  });

  app.post("/api/stories/:storyId/memories", async (req, reply) => {
    const { storyId } = req.params as { storyId: string };
    const body = validateBody(
      z.object({
        type: z.string().min(1),
        content: z.string().min(1),
        importance: z.number().int().min(1).max(5).optional(),
      }),
      req.body,
    );
    const mem = await memoriesService.createMemory({ storyId, ...body });
    return reply.status(201).send(mem);
  });

  app.patch("/api/memories/:memoryId", async (req) => {
    const { memoryId } = req.params as { memoryId: string };
    const body = validateBody(
      z.object({
        type: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        importance: z.number().int().min(1).max(5).optional(),
        isPinned: z.boolean().optional(),
      }),
      req.body,
    );
    return memoriesService.updateMemory(memoryId, body);
  });

  app.delete("/api/memories/:memoryId", async (req, reply) => {
    const { memoryId } = req.params as { memoryId: string };
    await memoriesService.deleteMemory(memoryId);
    return reply.status(204).send();
  });

  // ─────────────────────────────────────────────
  // PLOT THREADS
  // ─────────────────────────────────────────────
  app.get("/api/stories/:storyId/plot-threads", async (req) => {
    const { storyId } = req.params as { storyId: string };
    return plotThreadsService.getPlotThreadsByStory(storyId);
  });

  app.post("/api/stories/:storyId/plot-threads", async (req, reply) => {
    const { storyId } = req.params as { storyId: string };
    const body = validateBody(
      z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        status: z.enum(["active", "resolved", "dormant"]).optional(),
      }),
      req.body,
    );
    const pt = await plotThreadsService.createPlotThread({ storyId, ...body });
    return reply.status(201).send(pt);
  });

  app.patch("/api/plot-threads/:plotThreadId", async (req) => {
    const { plotThreadId } = req.params as { plotThreadId: string };
    const body = validateBody(
      z.object({
        title: z.string().optional(),
        status: z.enum(["active", "resolved", "dormant"]).optional(),
        content: z.string().optional(),
      }),
      req.body,
    );
    return plotThreadsService.updatePlotThread(plotThreadId, body);
  });

  app.delete("/api/plot-threads/:plotThreadId", async (req, reply) => {
    const { plotThreadId } = req.params as { plotThreadId: string };
    await plotThreadsService.deletePlotThread(plotThreadId);
    return reply.status(204).send();
  });

  // ─────────────────────────────────────────────
  // JOBS
  // ─────────────────────────────────────────────
  app.post("/api/stories/:storyId/jobs/summarize", async (req, reply) => {
    const { storyId } = req.params as { storyId: string };
    // Verify story exists
    await storiesService.getStoryById(storyId);
    // Get recent messages for manual summarization trigger
    const recent = await messagesService.getRecentMessages(storyId, 10);
    const userMsg = recent.find((m) => m.role === "user");
    const assistantMsg = recent.find((m) => m.role === "assistant");

    if (userMsg && assistantMsg) {
      await addProcessMemoryJob({
        storyId,
        userMessage: userMsg.content,
        assistantMessage: assistantMsg.content,
        userMessageId: userMsg.id,
      });
    }
    return reply.status(202).send({ message: "Summarization job queued" });
  });

  // ─────────────────────────────────────────────
  // IMAGES
  // ─────────────────────────────────────────────
  app.post("/api/stories/:storyId/images/generate", async (req) => {
    const { storyId } = req.params as { storyId: string };
    const body = validateBody(
      z.object({
        prompt: z.string().min(1),
        aspectRatio: z
          .enum(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"])
          .optional(),
        resolution: z.enum(["1k", "2k"]).optional(),
        n: z.number().int().min(1).max(4).optional(),
      }),
      req.body,
    );
    // Verify story exists
    await storiesService.getStoryById(storyId);
    const images = await generateImage(body);
    return { images };
  });

  // ─────────────────────────────────────────────
  // GLOBAL ERROR HANDLER
  // ─────────────────────────────────────────────
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      logger.warn(
        { err: err.message, code: err.code, path: req.url },
        "App error",
      );
      return reply.status(err.statusCode).send({
        error: err.code,
        message: err.message,
      });
    }

    logger.error({ err, path: req.url }, "Unhandled error");
    return reply.status(500).send({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  });
}
