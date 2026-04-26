import { query, queryOne } from "../../db/client";
import type { Story } from "../../db/schema";
import { newId } from "../../lib/ids";
import { NotFoundError } from "../../lib/errors";

const DEFAULT_SYSTEM_PROMPT = `You are an interactive long-form story engine — a collaborative prose writer, not a chatbot.
Your job is to continue the ongoing scene in vivid, immersive prose that respects every rule of the context above.

## OUTPUT LANGUAGE
Write in the story's configured language. If unspecified, match the user's last message.

## RESPONSE LENGTH (IMPORTANT)
Deliver a satisfying, well-paced beat each turn — neither a one-liner nor a wall of text.
- Default target: 3-6 paragraphs, roughly 250-500 words.
- Short reactive prompts may land at 2-3 paragraphs (~150-300 words).
- Dramatic or action-heavy prompts may stretch to 6-8 paragraphs (~500-700 words).
- Never exceed ~800 words. Never return fewer than 2 real paragraphs.
- Favor quality over quantity: cut any sentence that doesn't add sensation, emotion, action, or subtext.

## CRAFT RULES
1. Show, don't tell — dramatize emotion through body language, micro-actions, silence, and dialogue beats rather than naming it ("she was nervous").
2. Ground scenes in concrete sensory detail — sight, sound, touch, smell, proprioception — but avoid stacking more than two sensory details per paragraph.
3. Vary sentence length and rhythm. Let short sentences punch. Let longer ones breathe.
4. Use subtext in dialogue; characters rarely say exactly what they mean.
5. Maintain consistent POV, tense, and voice. Match the tone established by prior messages.
6. Avoid clichés, purple prose, and filler ("suddenly", "little did they know", "he couldn't help but...").

## STORY DISCIPLINE
1. Obey the RUNTIME GENERATION CONTROLS strictly. If scene lock is on: stay in-scene, don't skip time, don't change location, don't resolve the scene.
2. Honor the STORY BIBLE, CURRENT SCENE STATE, CHARACTERS, and MEMORIES above everything else.
3. Never speak or act on behalf of the user's character unless the user's last message clearly instructs you to. Let them drive their choices.
4. Don't summarize future events, skip ahead, or say "and then later..." unless the user explicitly asks.
5. Introduce new plot elements, characters, or revelations organically and one at a time.

## FORMATTING
- Write continuous prose. No chapter titles, headings, bullet lists, or section breaks.
- Place dialogue on its own lines where natural; use straight double quotes.
- No meta commentary ("Here is the next part..."). No out-of-character asides.
- Do not end with a question to the user. End on a concrete sensory, emotional, or action beat that naturally invites their next move.`;

export async function getAllStories(): Promise<Story[]> {
  return query<Story>("SELECT * FROM stories ORDER BY updated_at DESC");
}

export async function getStoryById(id: string): Promise<Story> {
  const story = await queryOne<Story>("SELECT * FROM stories WHERE id = $1", [
    id,
  ]);
  if (!story) throw new NotFoundError("Story", id);
  return story;
}

export interface CreateStoryInput {
  title: string;
  genre?: string;
  language?: string;
  systemPrompt?: string;
  stylePrompt?: string;
  storyBible?: string;
  currentSceneState?: string;
  currentTimelineState?: string;
  generationMode?: string;
  temperature?: number;
  maxOutputTokens?: number;
  sceneLock?: boolean;
  allowTimeSkip?: boolean;
  allowLocationChange?: boolean;
  allowMajorPlotProgress?: boolean;
}

export async function createStory(input: CreateStoryInput): Promise<Story> {
  const id = newId();
  const rows = await query<Story>(
    `INSERT INTO stories (id, title, genre, language, system_prompt, style_prompt, story_bible,
      current_scene_state, current_timeline_state, generation_mode, temperature, max_output_tokens, scene_lock, allow_time_skip, allow_location_change, allow_major_plot_progress, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
     RETURNING *`,
    [
      id,
      input.title,
      input.genre ?? null,
      input.language ?? "id",
      input.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      input.stylePrompt ?? null,
      input.storyBible ?? null,
      input.currentSceneState ?? null,
      input.currentTimelineState ?? null,
      input.generationMode ?? "balanced",
      input.temperature ?? 0.55,
      input.maxOutputTokens ?? 1400,
      input.sceneLock ?? true,
      input.allowTimeSkip ?? false,
      input.allowLocationChange ?? false,
      input.allowMajorPlotProgress ?? false,
    ],
  );
  return rows[0]!;
}

export interface UpdateStoryInput {
  title?: string;
  genre?: string;
  language?: string;
  systemPrompt?: string;
  stylePrompt?: string;
  storyBible?: string;
  currentSceneState?: string;
  currentTimelineState?: string;
  generationMode?: string;
  temperature?: number;
  maxOutputTokens?: number;
  sceneLock?: boolean;
  allowTimeSkip?: boolean;
  allowLocationChange?: boolean;
  allowMajorPlotProgress?: boolean;
}

export async function updateStory(
  id: string,
  input: UpdateStoryInput,
): Promise<Story> {
  await getStoryById(id); // throws if not found

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    title: "title",
    genre: "genre",
    language: "language",
    systemPrompt: "system_prompt",
    stylePrompt: "style_prompt",
    storyBible: "story_bible",
    currentSceneState: "current_scene_state",
    currentTimelineState: "current_timeline_state",
    generationMode: "generation_mode",
    temperature: "temperature",
    maxOutputTokens: "max_output_tokens",
    sceneLock: "scene_lock",
    allowTimeSkip: "allow_time_skip",
    allowLocationChange: "allow_location_change",
    allowMajorPlotProgress: "allow_major_plot_progress",
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    const val = (input as Record<string, unknown>)[key];
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }

  if (fields.length === 0) return getStoryById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const rows = await query<Story>(
    `UPDATE stories SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return rows[0]!;
}

export async function deleteStory(id: string): Promise<void> {
  await getStoryById(id);
  await query("DELETE FROM stories WHERE id = $1", [id]);
}

export async function resetStoryProgress(id: string): Promise<void> {
  await getStoryById(id);
  // Delete all messages, memories, and plot threads progress
  await query("DELETE FROM story_messages WHERE story_id = $1", [id]);
  await query("DELETE FROM story_memories WHERE story_id = $1", [id]);
  await query("UPDATE plot_threads SET status = $1 WHERE story_id = $2", [
    "active",
    id,
  ]);
  await query(
    "UPDATE characters SET current_state = NULL WHERE story_id = $1",
    [id],
  );
  await query(
    "UPDATE stories SET current_scene_state = NULL, current_timeline_state = NULL WHERE id = $1",
    [id],
  );
}
