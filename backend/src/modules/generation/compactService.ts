import { generateText } from "../../providers/grok/grokText";
import {
  getMessagesForSummary,
  getMessagesByStory,
} from "../messages/messagesService";
import {
  applyStorySummary,
  getStoryById,
} from "../stories/storiesService";
import { logger } from "../../lib/logger";
import type { Story } from "../../db/schema";

/** Approximate chars-per-token for the tokenizer we don't have bundled.
 *  4.0 is the conventional rough estimate for English/Indonesian prose and
 *  is what OpenAI's own "count" helpers fall back to. Good enough for a
 *  budget bar; not used for billing. */
const CHARS_PER_TOKEN = 4;

/** Model-side context budget we *want* to stay under. xAI Grok ships with
 *  a 131 072 token window; we reserve ~40k for output + safety margin. */
export const CONTEXT_TOKEN_BUDGET = 90_000;

/** How many of the most recent messages to keep as live context (i.e.
 *  never fold into the summary). Keeping a healthy tail preserves the
 *  conversational voice and recent beats the user is most likely to
 *  reference. */
const KEEP_LAST_N_TURNS = 12;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface ContextUsage {
  estimatedTokens: number;
  budget: number;
  /** 0..1 */
  fraction: number;
  messageCount: number;
  summarizedMessageCount: number;
  hasSummary: boolean;
  /** True when the worker would run compact on its own. */
  shouldCompact: boolean;
}

/**
 * Cheap, read-only estimate of how much of the context window the current
 * story would consume if generated right now. Used by the frontend
 * indicator AND by the auto-compact trigger.
 */
export async function getContextUsage(storyId: string): Promise<ContextUsage> {
  const [story, all] = await Promise.all([
    getStoryById(storyId),
    getMessagesByStory(storyId, 10_000),
  ]);

  const cutoff = story.summarized_up_to_created_at;
  const livePortion = cutoff
    ? all.filter((m) => m.created_at > cutoff)
    : all;
  const summarizedCount = all.length - livePortion.length;

  let charCount =
    (story.system_prompt?.length ?? 0) +
    (story.style_prompt?.length ?? 0) +
    (story.story_bible?.length ?? 0) +
    (story.current_scene_state?.length ?? 0) +
    (story.current_timeline_state?.length ?? 0) +
    (story.story_summary?.length ?? 0);
  for (const m of livePortion) charCount += m.content.length;

  const estimatedTokens = Math.ceil(charCount / CHARS_PER_TOKEN);
  const fraction = estimatedTokens / CONTEXT_TOKEN_BUDGET;
  return {
    estimatedTokens,
    budget: CONTEXT_TOKEN_BUDGET,
    fraction,
    messageCount: livePortion.length,
    summarizedMessageCount: summarizedCount,
    hasSummary: !!story.story_summary,
    // Trip auto-compact at 70% of budget OR 60 live messages. Both
    // thresholds matter: a short-but-very-dense chat can still blow the
    // window, and a very chatty short-message thread can bloat raw count
    // without actually being near the token limit.
    shouldCompact: fraction > 0.7 || livePortion.length > 60,
  };
}

const SUMMARY_SYSTEM_PROMPT = `You are a narrative compactor for a long-form collaborative story.

Given a chronological transcript of a roleplay/chat-fiction story, produce a single condensed "story so far" summary that another writer will use as their PRIMARY reference for everything that happened in the folded section. The full messages will not be available to them.

Requirements:
- Preserve narrative continuity: plot events, scene transitions, character decisions, revealed backstory, relationships, location changes, emotional arcs.
- Retain concrete names (characters, places, objects, dates) exactly.
- Retain unresolved threads and promises (setups without payoff, mysteries, goals, tensions).
- Order chronologically. Use present or past tense consistently with the source.
- DO NOT add new events, interpretations, or opinions not present in the transcript.
- DO NOT include dialogue transcripts — paraphrase dialogue into beats.
- Length: 8-18 sentences total. Group related events into compound sentences. Never shorter than 5 sentences; never longer than 20.
- Match the transcript's language (Indonesian, English, etc.). If mixed, use the dominant language.
- Write as prose paragraphs, not bullet lists.
- Do not wrap the output in quotes or any preamble like "Here is the summary:". Output the summary directly.`;

/**
 * Fold older messages into a single condensed summary. If a prior summary
 * exists, the new summary SUPERSEDES it (we re-summarize everything from
 * the start up to `keepLastN` from the end) so we don't end up with a
 * stack of increasingly lossy summaries.
 */
export async function compactStory(
  storyId: string,
  opts: { keepLastN?: number } = {},
): Promise<{
  story: Story;
  summary: string;
  summarizedMessageCount: number;
} | null> {
  const keepLastN = opts.keepLastN ?? KEEP_LAST_N_TURNS;
  const toSummarize = await getMessagesForSummary(storyId, keepLastN);
  if (toSummarize.length === 0) {
    logger.info(
      { storyId },
      "compactStory: nothing to summarize (short chat)",
    );
    return null;
  }

  const transcript = toSummarize
    .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
    .join("\n\n");

  logger.info(
    { storyId, count: toSummarize.length },
    "compactStory: summarizing older messages",
  );

  const summary = await generateText({
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Summarize the following story-so-far. Transcript follows:\n\n${transcript}`,
      },
    ],
    model: "reasoning",
    maxTokens: 1200,
    temperature: 0.3,
  });

  const cutoff = toSummarize[toSummarize.length - 1]!.created_at;
  const story = await applyStorySummary(storyId, summary.trim(), cutoff);

  return {
    story,
    summary: summary.trim(),
    summarizedMessageCount: toSummarize.length,
  };
}
