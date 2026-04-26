import { getStoryById } from "../stories/storiesService";
import { getCharactersByStory } from "../characters/charactersService";
import { getRecentMessages, createMessage } from "../messages/messagesService";
import { searchMemoriesByText } from "../memories/memoriesService";
import { getActivePlotThreads } from "../plotThreads/plotThreadsService";
import { generateText } from "../../providers/grok/grokText";
import { streamText } from "../../providers/grok/grokStreaming";
import { addProcessMemoryJob } from "../../queues/storyQueue";
import { logger } from "../../lib/logger";
import type { FastifyReply } from "fastify";

/**
 * Build the structured runtime prompt for story continuation.
 * Combines all story context into a single coherent system prompt.
 */
function buildStoryPrompt(context: {
  story: Awaited<ReturnType<typeof getStoryById>>;
  characters: Awaited<ReturnType<typeof getCharactersByStory>>;
  activePlotThreads: Awaited<ReturnType<typeof getActivePlotThreads>>;
  relevantMemories: string[];
  settings: {
    mode: string;
    sceneLock: boolean;
    allowTimeSkip: boolean;
    allowLocationChange: boolean;
    allowMajorPlotProgress: boolean;
  };
}): string {
  const { story, characters, activePlotThreads, relevantMemories, settings } =
    context;

  const sections: string[] = [];

  // 1. Base system / writing rules
  sections.push(`## SYSTEM WRITING RULES
${story.system_prompt ?? "Kamu adalah mesin cerita interaktif. Tulis prosa yang immersif dan alami."}`);

  // 2. Writing Style
  if (story.style_prompt) {
    sections.push(`## WRITING STYLE
${story.style_prompt}`);
  }

  // 3. Story Bible
  if (story.story_bible) {
    sections.push(`## STORY BIBLE
${story.story_bible}`);
  }

  // 3. Current Scene State
  if (story.current_scene_state) {
    sections.push(`## CURRENT SCENE STATE
${story.current_scene_state}`);
  }

  // 4. Timeline State
  if (story.current_timeline_state) {
    sections.push(`## TIMELINE STATE
${story.current_timeline_state}`);
  }

  // 5. Main Characters
  if (characters.length > 0) {
    const charText = characters
      .map(
        (c) =>
          `### ${c.name}${c.role ? ` (${c.role})` : ""}
${[c.description, c.personality, c.relationship_notes, c.current_state]
  .filter(Boolean)
  .join("\n")}`,
      )
      .join("\n\n");
    sections.push(`## MAIN CHARACTERS\n${charText}`);
  }

  // 6. Active Plot Threads
  if (activePlotThreads.length > 0) {
    const threadText = activePlotThreads
      .map((pt) => `- **${pt.title}**: ${pt.content ?? "(active)"}`)
      .join("\n");
    sections.push(`## ACTIVE PLOT THREADS\n${threadText}`);
  }

  // 7. Relevant Long-Term Memories
  if (relevantMemories.length > 0) {
    sections.push(
      `## RELEVANT LONG-TERM MEMORIES\n${relevantMemories.map((m) => `- ${m}`).join("\n")}`,
    );
  }

  // 8. Runtime Generation Controls
  const runtimeControls: string[] = [];
  runtimeControls.push(`- Mode: ${settings.mode}`);
  if (settings.mode === "slow_scene") {
    runtimeControls.push(`- Stay inside the current scene.`);
    runtimeControls.push(`- Do not skip time.`);
    runtimeControls.push(`- Do not change location.`);
    runtimeControls.push(`- Do not resolve the scene.`);
    runtimeControls.push(`- Do not introduce major new events.`);
    runtimeControls.push(`- Do not introduce major new characters.`);
    runtimeControls.push(
      `- Do not escalate stakes unless the user explicitly asks.`,
    );
    runtimeControls.push(
      `- Focus on dialogue, small physical actions, atmosphere, emotional nuance, and realistic pacing.`,
    );
    runtimeControls.push(
      `- Continue only the immediate next beat of the scene.`,
    );
    runtimeControls.push(`- Do not summarize what happens later.`);
    runtimeControls.push(`- Do not write an ending for the scene.`);
  }

  if (!settings.allowTimeSkip) {
    runtimeControls.push(`- Time skip is forbidden.`);
  }
  if (!settings.allowLocationChange) {
    runtimeControls.push(`- Location change is forbidden.`);
  }
  if (!settings.allowMajorPlotProgress) {
    runtimeControls.push(`- Major plot progression is forbidden.`);
  }

  if (runtimeControls.length > 0) {
    sections.push(
      `## RUNTIME GENERATION CONTROLS\n${runtimeControls.join("\n")}`,
    );
  }

  // 9. Writing behavior reminder
  sections.push(`## TASK
Lanjutkan cerita berdasarkan arahan pengguna di bawah ini. Tulis dalam bahasa ${story.language === "id" ? "Indonesia" : story.language}.
Jangan buat judul bab. Jangan tanya pengguna di akhir. Tulis prosa yang mengalir alami.`);

  return sections.join("\n\n---\n\n");
}

export interface GenerateStoryInput {
  storyId: string;
  userMessage: string;
  generationOverride?: {
    mode?: string;
    temperature?: number;
    maxOutputTokens?: number;
    sceneLock?: boolean;
    allowTimeSkip?: boolean;
    allowLocationChange?: boolean;
    allowMajorPlotProgress?: boolean;
  };
}

/**
 * Main story orchestration — streaming variant.
 * Flow:
 *   1. Load all story context
 *   2. Build prompt
 *   3. Stream AI response to client
 *   4. Save messages to DB (fire-and-forget)
 *   5. Queue background memory processing job
 */
export async function generateStoryStream(
  input: GenerateStoryInput,
  reply: FastifyReply,
): Promise<void> {
  logger.info({ storyId: input.storyId }, "Story generation start (stream)");

  // 1. Load context in parallel
  const [story, characters, activePlotThreads, recentMessages] =
    await Promise.all([
      getStoryById(input.storyId),
      getCharactersByStory(input.storyId),
      getActivePlotThreads(input.storyId),
      getRecentMessages(input.storyId, 10),
    ]);

  // 2. Search relevant memories using the user message as search text
  const relevantMemories = await searchMemoriesByText(
    input.storyId,
    input.userMessage,
    6,
  );

  const settings = {
    mode:
      input.generationOverride?.mode ?? story.generation_mode ?? "slow_scene",
    temperature:
      input.generationOverride?.temperature ??
      Number(story.temperature) ??
      0.45,
    maxOutputTokens:
      input.generationOverride?.maxOutputTokens ??
      story.max_output_tokens ??
      1200,
    sceneLock: input.generationOverride?.sceneLock ?? story.scene_lock ?? true,
    allowTimeSkip:
      input.generationOverride?.allowTimeSkip ?? story.allow_time_skip ?? false,
    allowLocationChange:
      input.generationOverride?.allowLocationChange ??
      story.allow_location_change ??
      false,
    allowMajorPlotProgress:
      input.generationOverride?.allowMajorPlotProgress ??
      story.allow_major_plot_progress ??
      false,
  };

  // 3. Build prompt
  const systemPrompt = buildStoryPrompt({
    story,
    characters,
    activePlotThreads,
    relevantMemories: relevantMemories.map((m) => m.content),
    settings,
  });

  // 4. Build messages array for the AI (recent story context)
  const contextMessages = recentMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Add current user direction
  contextMessages.push({ role: "user", content: input.userMessage });

  // 5. Stream the response — this writes SSE directly to reply
  const assistantContent = await streamText(
    {
      systemPrompt,
      messages: contextMessages,
      temperature: settings.temperature,
      maxTokens: settings.maxOutputTokens,
    },
    reply,
  );

  // 6. Save messages to DB asynchronously (don't block streaming)
  void (async () => {
    try {
      const userMsg = await createMessage({
        storyId: input.storyId,
        role: "user",
        content: input.userMessage,
      });

      await createMessage({
        storyId: input.storyId,
        role: "assistant",
        content: assistantContent,
      });

      // 7. Queue background memory processing
      await addProcessMemoryJob({
        storyId: input.storyId,
        userMessage: input.userMessage,
        assistantMessage: assistantContent,
        userMessageId: userMsg.id,
      });
    } catch (err) {
      logger.error({ err }, "Error saving messages after generation");
    }
  })();

  logger.info({ storyId: input.storyId }, "Story generation complete (stream)");
}

/**
 * Non-streaming variant — returns full text.
 * Used for the non-stream endpoint.
 */
export async function generateStoryText(input: GenerateStoryInput): Promise<{
  content: string;
  userMessageId: string;
  assistantMessageId: string;
}> {
  logger.info({ storyId: input.storyId }, "Story generation start (text)");

  const [story, characters, activePlotThreads, recentMessages] =
    await Promise.all([
      getStoryById(input.storyId),
      getCharactersByStory(input.storyId),
      getActivePlotThreads(input.storyId),
      getRecentMessages(input.storyId, 10),
    ]);

  const relevantMemories = await searchMemoriesByText(
    input.storyId,
    input.userMessage,
    6,
  );

  const settings = {
    mode:
      input.generationOverride?.mode ?? story.generation_mode ?? "slow_scene",
    temperature:
      input.generationOverride?.temperature ??
      Number(story.temperature) ??
      0.45,
    maxOutputTokens:
      input.generationOverride?.maxOutputTokens ??
      story.max_output_tokens ??
      1200,
    sceneLock: input.generationOverride?.sceneLock ?? story.scene_lock ?? true,
    allowTimeSkip:
      input.generationOverride?.allowTimeSkip ?? story.allow_time_skip ?? false,
    allowLocationChange:
      input.generationOverride?.allowLocationChange ??
      story.allow_location_change ??
      false,
    allowMajorPlotProgress:
      input.generationOverride?.allowMajorPlotProgress ??
      story.allow_major_plot_progress ??
      false,
  };

  const systemPrompt = buildStoryPrompt({
    story,
    characters,
    activePlotThreads,
    relevantMemories: relevantMemories.map((m) => m.content),
    settings,
  });

  const contextMessages = [
    ...recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: input.userMessage },
  ];

  const content = await generateText({
    systemPrompt,
    messages: contextMessages,
    temperature: settings.temperature,
    maxTokens: settings.maxOutputTokens,
  });

  const userMsg = await createMessage({
    storyId: input.storyId,
    role: "user",
    content: input.userMessage,
  });
  const assistantMsg = await createMessage({
    storyId: input.storyId,
    role: "assistant",
    content,
  });

  await addProcessMemoryJob({
    storyId: input.storyId,
    userMessage: input.userMessage,
    assistantMessage: content,
    userMessageId: userMsg.id,
  });

  logger.info({ storyId: input.storyId }, "Story generation complete (text)");

  return {
    content,
    userMessageId: userMsg.id,
    assistantMessageId: assistantMsg.id,
  };
}
