import { query, queryOne } from '../../db/client';
import type { Story } from '../../db/schema';
import { newId } from '../../lib/ids';
import { NotFoundError } from '../../lib/errors';

const DEFAULT_SYSTEM_PROMPT = `Kamu adalah mesin cerita interaktif panjang (slow-burn text adventure).
Tulis dalam bahasa Indonesia yang natural kecuali pengaturan cerita meminta lain.
Lanjutkan adegan saat ini secara perlahan dan detail.

ATURAN PACING & BERCERITA (SANGAT PENTING):
1. PACING SANGAT LAMBAT: Fokus pada atmosfer, emosi, detail lingkungan, dan pikiran karakter.
2. JANGAN MEMAJUKAN PLOT TERLALU CEPAT: Jangan memasukkan rentetan kejadian penting (seperti mendapat email krusial lalu langsung bertemu seseorang) dalam satu respons. Pecah adegan menjadi momen-momen kecil.
3. JANGAN MENGAMBIL ALIH KARAKTER PENGGUNA: Biarkan pengguna bereaksi terhadap satu kejadian kecil sebelum kejadian berikutnya terjadi.
4. Jaga konsistensi karakter, hubungan, dan kesinambungan emosional.
5. Jangan ajukan pertanyaan kepada pengguna di akhir respons. Jangan tulis judul bab.
6. Ikuti story bible dan kondisi adegan saat ini di atas segalanya, namun ungkapkan elemen-elemen tersebut secara perlahan, bukan sekaligus.`;

export async function getAllStories(): Promise<Story[]> {
  return query<Story>(
    'SELECT * FROM stories ORDER BY updated_at DESC',
  );
}

export async function getStoryById(id: string): Promise<Story> {
  const story = await queryOne<Story>('SELECT * FROM stories WHERE id = $1', [id]);
  if (!story) throw new NotFoundError('Story', id);
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
      input.language ?? 'id',
      input.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      input.stylePrompt ?? null,
      input.storyBible ?? null,
      input.currentSceneState ?? null,
      input.currentTimelineState ?? null,
      input.generationMode ?? 'slow_scene',
      input.temperature ?? 0.45,
      input.maxOutputTokens ?? 1200,
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

export async function updateStory(id: string, input: UpdateStoryInput): Promise<Story> {
  await getStoryById(id); // throws if not found

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    title: 'title',
    genre: 'genre',
    language: 'language',
    systemPrompt: 'system_prompt',
    stylePrompt: 'style_prompt',
    storyBible: 'story_bible',
    currentSceneState: 'current_scene_state',
    currentTimelineState: 'current_timeline_state',
    generationMode: 'generation_mode',
    temperature: 'temperature',
    maxOutputTokens: 'max_output_tokens',
    sceneLock: 'scene_lock',
    allowTimeSkip: 'allow_time_skip',
    allowLocationChange: 'allow_location_change',
    allowMajorPlotProgress: 'allow_major_plot_progress',
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
    `UPDATE stories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return rows[0]!;
}

export async function deleteStory(id: string): Promise<void> {
  await getStoryById(id);
  await query('DELETE FROM stories WHERE id = $1', [id]);
}

export async function resetStoryProgress(id: string): Promise<void> {
  await getStoryById(id);
  // Delete all messages, memories, and plot threads progress
  await query('DELETE FROM story_messages WHERE story_id = $1', [id]);
  await query('DELETE FROM story_memories WHERE story_id = $1', [id]);
  await query('UPDATE plot_threads SET status = $1 WHERE story_id = $2', ['active', id]);
  await query('UPDATE characters SET current_state = NULL WHERE story_id = $1', [id]);
  await query('UPDATE stories SET current_scene_state = NULL, current_timeline_state = NULL WHERE id = $1', [id]);
}
