import { getStoryById } from "../stories/storiesService";
import { getCharactersByStory } from "../characters/charactersService";
import { getRecentMessages, createMessage } from "../messages/messagesService";
import { KEEP_LAST_N_TURNS } from "./compactService";
import {
  searchMemoriesByText,
  getPinnedMemories,
} from "../memories/memoriesService";
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

  // 1. Base system / writing rules (largely static → cache-friendly prefix)
  sections.push(`## SYSTEM WRITING RULES
${story.system_prompt ?? "You are an interactive long-form story engine. Write immersive, natural prose that respects the context below."}`);

  // 2. Writing Style
  if (story.style_prompt) {
    sections.push(`## WRITING STYLE
${story.style_prompt}`);
  }

  // 3. Story Bible — framed as background context, NOT a script to execute.
  if (story.story_bible) {
    sections.push(`## STORY BIBLE (BACKGROUND CONTEXT — NOT A SCRIPT)
The following is worldbuilding + backstory the story takes place inside of.
It constrains tone, lore, and existing relationships — it does NOT compel
you to advance its "big motivation", grand reveal, or secret plot on your
own initiative. Only surface bible elements when the user's direction
actually points there.

${story.story_bible}`);
  }

  // 4. Main Characters
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

  // 5. Current Scene State (dynamic — placed after static context)
  if (story.current_scene_state) {
    sections.push(`## CURRENT SCENE STATE
${story.current_scene_state}`);
  }

  // 6. Timeline State
  if (story.current_timeline_state) {
    sections.push(`## TIMELINE STATE
${story.current_timeline_state}`);
  }

  // 7. Active Plot Threads
  if (activePlotThreads.length > 0) {
    const threadText = activePlotThreads
      .map((pt) => `- **${pt.title}**: ${pt.content ?? "(active)"}`)
      .join("\n");
    sections.push(`## ACTIVE PLOT THREADS\n${threadText}`);
  }

  // 8. Story-so-far summary (only present after compact). Older messages
  //    folded into this summary are excluded from the raw message list
  //    below, saving tokens without losing continuity.
  if (story.story_summary) {
    sections.push(`## STORY SO FAR (CONDENSED)
${story.story_summary}`);
  }

  // 9. Relevant Long-Term Memories
  if (relevantMemories.length > 0) {
    sections.push(
      `## RELEVANT LONG-TERM MEMORIES\n${relevantMemories.map((m) => `- ${m}`).join("\n")}`,
    );
  }

  // 9. Runtime Generation Controls (mode-aware length + pacing)
  const lengthGuide: Record<string, string> = {
    slow_scene:
      "Target 3-5 paragraphs (~250-450 words). Favor atmosphere, dialogue beats, and internal life over plot motion.",
    balanced:
      "Target 3-6 paragraphs (~300-550 words). Progress the beat modestly; end on a concrete sensation or action.",
    progress_story:
      "Target 4-7 paragraphs (~400-650 words). Let the story move forward clearly, but still one beat at a time.",
    cinematic:
      "Target 4-7 paragraphs (~450-700 words). Lean into vivid staging and dramatic framing without purple prose.",
  };

  const runtimeControls: string[] = [];
  runtimeControls.push(`- Mode: ${settings.mode}`);
  runtimeControls.push(
    `- Length guide: ${lengthGuide[settings.mode] ?? lengthGuide.balanced}`,
  );
  runtimeControls.push(
    `- Hard cap: never exceed ~800 words; never write fewer than 2 real paragraphs.`,
  );
  runtimeControls.push(
    `- Obey the user's last message literally. Dramatize ONLY what they direct. Do not invent extra actions, phone calls, mental simulations, flashbacks, or plot moves they didn't ask for.`,
  );
  runtimeControls.push(
    `- Do NOT progress the Story Bible's "big motivation", grand reveal, or secret project on your own initiative. Bible context is background; only surface it when the user's direction points there.`,
  );
  runtimeControls.push(
    `- If the user's prompt is mundane/static (idling, bengong, scrolling phone, smoking, coffee), the beat stays mundane. Tiny sensory detail > plot motion.`,
  );
  runtimeControls.push(
    `- Never put new dialogue, decisions, or committed actions in the user's character's mouth beyond what they wrote.`,
  );
  runtimeControls.push(
    `- Formatting: prose only. Inline \`*italic*\` (for internal thoughts / emphasis) and \`**bold**\` (very sparingly) are the ONLY markdown allowed. NO headings (\`#\`), NO bullet/numbered lists, NO tables, NO code blocks, NO links, NO horizontal rules. Do not wrap whole paragraphs in italic or bold.`,
  );
  runtimeControls.push(
    `- Anti-AI tells: MAX ONE em-dash (—) per paragraph, and only for genuine interruption/aside (prefer periods, commas, colons, semicolons, parentheses). Do NOT use em-dashes as decorative style. Ban AI-ism phrases like "a tapestry of", "a symphony of", "not just X but Y", "delve into", "it's important to note", "palpable tension", "hustle and bustle", "menari-nari", "bagaikan simfoni", "seolah waktu berhenti". No vague sensory filler ("something shifted", "the air felt different"), no tricolons-of-abstractions ("the pain, the fear, the hope"), no paragraph-ending emotional summaries ("and in that moment, he knew...").`,
  );

  if (settings.sceneLock || settings.mode === "slow_scene") {
    runtimeControls.push(`- Stay inside the current scene.`);
    runtimeControls.push(`- Continue only the immediate next beat.`);
    runtimeControls.push(`- Do not resolve or end the scene.`);
    runtimeControls.push(`- Do not summarize future events.`);
  }
  if (settings.mode === "slow_scene") {
    runtimeControls.push(
      `- Focus on dialogue, small physical actions, atmosphere, emotional nuance, and realistic pacing.`,
    );
    runtimeControls.push(
      `- Do not escalate stakes unless the user explicitly asks.`,
    );
  }

  if (!settings.allowTimeSkip) {
    runtimeControls.push(`- Time skip is forbidden.`);
  }
  if (!settings.allowLocationChange) {
    runtimeControls.push(`- Location change is forbidden.`);
  }
  if (!settings.allowMajorPlotProgress) {
    runtimeControls.push(
      `- Major plot progression is forbidden (no new major characters, no stake escalation, no resolving major events).`,
    );
  }

  sections.push(
    `## RUNTIME GENERATION CONTROLS\n${runtimeControls.join("\n")}`,
  );

  // 10. Writing behavior reminder
  const langLabel =
    story.language === "id"
      ? "Bahasa Indonesia yang natural"
      : story.language === "en"
        ? "natural English"
        : story.language;
  sections.push(`## TASK
Continue the story from the user's direction below. Write in ${langLabel}.
No chapter titles. No questions to the user at the end. Flowing, natural prose only.`);

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

  // 1. Load context in parallel. Fetch story first (so we can honor any
  //    compaction cutoff when pulling recent messages), then fan out the
  //    rest in parallel.
  const story = await getStoryById(input.storyId);
  const [characters, activePlotThreads, recentMessages] = await Promise.all([
    getCharactersByStory(input.storyId),
    getActivePlotThreads(input.storyId),
    getRecentMessages(input.storyId, KEEP_LAST_N_TURNS, true),
  ]);

  // 2. Pull relevant memories: pinned-always + FTS-matched by user message.
  //    Pinned entries are surfaced unconditionally so the model can't "forget"
  //    a fact the user explicitly marked important.
  const [pinned, matched] = await Promise.all([
    getPinnedMemories(input.storyId),
    searchMemoriesByText(input.storyId, input.userMessage, 6),
  ]);
  const seen = new Set<string>();
  const relevantMemories = [...pinned, ...matched].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const settings = {
    mode: input.generationOverride?.mode ?? story.generation_mode ?? "balanced",
    temperature:
      input.generationOverride?.temperature ??
      Number(story.temperature) ??
      0.55,
    maxOutputTokens:
      input.generationOverride?.maxOutputTokens ??
      story.max_output_tokens ??
      1400,
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

  const story = await getStoryById(input.storyId);
  const [characters, activePlotThreads, recentMessages] = await Promise.all([
    getCharactersByStory(input.storyId),
    getActivePlotThreads(input.storyId),
    getRecentMessages(input.storyId, KEEP_LAST_N_TURNS, true),
  ]);

  // Union pinned + FTS-matched memories, dedup by id. Matches the
  // non-streaming path so the model sees the same memory shape.
  const [pinnedStream, matchedStream] = await Promise.all([
    getPinnedMemories(input.storyId),
    searchMemoriesByText(input.storyId, input.userMessage, 6),
  ]);
  const seenStream = new Set<string>();
  const relevantMemories = [...pinnedStream, ...matchedStream].filter((m) => {
    if (seenStream.has(m.id)) return false;
    seenStream.add(m.id);
    return true;
  });

  const settings = {
    mode: input.generationOverride?.mode ?? story.generation_mode ?? "balanced",
    temperature:
      input.generationOverride?.temperature ??
      Number(story.temperature) ??
      0.55,
    maxOutputTokens:
      input.generationOverride?.maxOutputTokens ??
      story.max_output_tokens ??
      1400,
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
