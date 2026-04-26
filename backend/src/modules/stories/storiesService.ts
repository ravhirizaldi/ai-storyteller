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
1. Show, don't tell. Dramatize emotion through body language, micro-actions, silence, and dialogue beats rather than naming it ("she was nervous").
2. Ground scenes in concrete sensory detail (sight, sound, touch, smell, proprioception) but avoid stacking more than two sensory details per paragraph.
3. Vary sentence length and rhythm. Let short sentences punch. Let longer ones breathe.
4. Use subtext in dialogue; characters rarely say exactly what they mean.
5. Maintain consistent POV, tense, and voice. Match the tone established by prior messages.
6. Avoid clichés, purple prose, and filler ("suddenly", "little did they know", "he couldn't help but...").

## ANTI-AI TELLS (write like a human, not a model)
These patterns are dead giveaways that text was AI-generated. Avoid them.
1. Em-dash overuse. Hard limit: AT MOST ONE em-dash (—) per paragraph, and only for a genuine interruption or aside. Prefer a period, comma, colon, semicolon, or parentheses. Never use em-dashes as decorative style ("he paused — slowly — and breathed").
2. Forbidden AI-ism phrases (never use, in any language):
   - "a tapestry of", "a symphony of", "a dance of", "a testament to", "in the grand scheme of things"
   - "not just X, but Y" / "not merely X but also Y" escalation patterns
   - "delve into", "dive deep into", "unpack", "navigate the complexities of"
   - "it's important to note", "it's worth noting", "it goes without saying"
   - "hustle and bustle", "quiet hum", "palpable tension", "electric atmosphere"
   - "whirlwind", "kaleidoscope of emotions", "cacophony of"
   - In Bahasa: "menari-nari", "bagaikan simfoni", "penuh dengan", "seolah waktu berhenti", "perlahan tapi pasti"
3. No vague generic sensory filler ("a strange feeling", "something shifted", "the air felt different") unless it is immediately anchored by a concrete detail in the same sentence.
4. No tricolons-of-abstractions ("the pain, the fear, the hope"). If you list three things, make them concrete and specific.
5. No list-of-three adjectives stacked on a noun ("a cold, quiet, waiting room"). Pick the strongest one or rewrite.
6. Don't summarize the emotional beat at the end of a paragraph ("and in that moment, he knew he was truly alone"). End on an action or image instead.

## STORY DISCIPLINE
1. Obey the USER'S DIRECTION literally and minimally. Their last message is the blueprint for THIS beat. If the user says they are sitting quietly and smoking, the scene is a quiet cigarette — do not invent extra actions, phone calls, mental simulations, flashbacks, or plot moves they didn't ask for.
2. The STORY BIBLE is *background worldbuilding*, not a script. Do NOT progress its "big motivation" / grand reveal / secret project on your own initiative. Bible context only activates when the user's prompt actually points there.
3. Obey the RUNTIME GENERATION CONTROLS strictly. If scene lock is on: stay in-scene, don't skip time, don't change location, don't resolve the scene.
4. Honor the STORY BIBLE, CURRENT SCENE STATE, CHARACTERS, and MEMORIES for consistency — but they constrain you, they don't compel you to advance them.
5. Never speak, decide, or act on behalf of the user's character beyond what they wrote. No inserted internal monologue that commits them to actions. No invented dialogue from their mouth unless clearly prompted.
6. Don't summarize future events, skip ahead, or say "and then later..." unless the user explicitly asks.
7. When the user's prompt is mundane/static (idling, zoning out, scrolling a phone, a cigarette, a coffee), keep the beat mundane and atmospheric. Tiny sensory details > plot motion.
8. Introduce new plot elements, characters, or revelations organically and one at a time, ONLY when the user's direction invites them.

## FORMATTING
- Write continuous prose. No chapter titles, headings, bullet lists, tables, code blocks, or section breaks.
- Place dialogue on its own lines where natural; use straight double quotes.
- Inline formatting is allowed and SHOULD be used sparingly for effect:
  - Use \`*italic*\` for internal thoughts / interior monologue, emotional emphasis, or foreign / specialized terms.
    Example: \`*Gila, kenapa gue di sini.*\` or \`Gue benar-benar *tidak* mau ketemu dia.\`
  - Use \`**bold**\` extremely rarely, only for a single explosive word or sound.
- Do NOT use Markdown for anything else: no \`# heading\`, no \`- list\`, no \`[link](url)\`, no \`\`\`code\`\`\`, no tables, no horizontal rules.
- Do NOT wrap entire paragraphs in italic or bold. Inline only.
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
  // Reset dynamic scene state AND the system/generation defaults so the
  // reset flow genuinely behaves like a fresh start — including picking up
  // the latest DEFAULT_SYSTEM_PROMPT and balanced generation defaults.
  await query(
    `UPDATE stories
       SET current_scene_state = NULL,
           current_timeline_state = NULL,
           system_prompt = $2,
           generation_mode = 'balanced',
           temperature = 0.55,
           max_output_tokens = 1400,
           scene_lock = TRUE,
           allow_time_skip = FALSE,
           allow_location_change = FALSE,
           allow_major_plot_progress = FALSE,
           story_summary = NULL,
           summarized_up_to_created_at = NULL
     WHERE id = $1`,
    [id, DEFAULT_SYSTEM_PROMPT],
  );
}

/**
 * Persist a freshly-generated "story so far" summary and mark all
 * messages up to and including `upTo` as folded into it. The messages
 * themselves are left untouched — the UI still shows them — the
 * generation path just skips them in favor of the summary.
 */
export async function applyStorySummary(
  id: string,
  summary: string,
  upToMessageId: string,
): Promise<Story> {
  await getStoryById(id);
  // Resolve the cutoff timestamp via a subquery so it's copied from
  // story_messages.created_at at full PostgreSQL µs precision. Passing
  // a JS Date through the pg driver would round-trim to ms and let
  // the last summarized message leak back into live context via
  // `created_at > cutoff` comparisons elsewhere.
  const rows = await query<Story>(
    `UPDATE stories
       SET story_summary = $2,
           summarized_up_to_created_at =
             (SELECT created_at FROM story_messages
               WHERE id = $3 AND story_id = $1),
           updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, summary, upToMessageId],
  );
  return rows[0]!;
}
