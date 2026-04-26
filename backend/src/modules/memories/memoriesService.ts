import { query, queryOne } from '../../db/client';
import type { StoryMemory } from '../../db/schema';
import { newId } from '../../lib/ids';
import { NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export async function getMemoriesByStory(storyId: string): Promise<StoryMemory[]> {
  return query<StoryMemory>(
    'SELECT * FROM story_memories WHERE story_id = $1 ORDER BY importance DESC, created_at DESC',
    [storyId],
  );
}

export interface CreateMemoryInput {
  storyId: string;
  type: string;
  content: string;
  embedding?: number[];
  importance?: number;
  sourceMessageId?: string;
}

export async function createMemory(input: CreateMemoryInput): Promise<StoryMemory> {
  const id = newId();

  const rows = await query<StoryMemory>(
    `INSERT INTO story_memories (id, story_id, type, content, importance,
      source_message_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
    [
      id, input.storyId, input.type, input.content,
      input.importance ?? 1, input.sourceMessageId ?? null,
    ],
  );
  return rows[0]!;
}

export async function deleteMemory(id: string): Promise<void> {
  const mem = await queryOne<StoryMemory>('SELECT id FROM story_memories WHERE id = $1', [id]);
  if (!mem) throw new NotFoundError('Memory', id);
  await query('DELETE FROM story_memories WHERE id = $1', [id]);
}

/**
 * Search memories using PostgreSQL full-text search.
 * This is the fallback strategy when pgvector embeddings are not configured.
 * When an embedding provider is available, replace this with a vector cosine search.
 */
export async function searchMemoriesByText(
  storyId: string,
  searchText: string,
  limit = 8,
): Promise<StoryMemory[]> {
  try {
    const rows = await query<StoryMemory>(
      `SELECT *, ts_rank(to_tsvector('simple', content), plainto_tsquery('simple', $2)) AS rank
       FROM story_memories
       WHERE story_id = $1
         AND to_tsvector('simple', content) @@ plainto_tsquery('simple', $2)
       ORDER BY rank DESC, importance DESC
       LIMIT $3`,
      [storyId, searchText, limit],
    );

    if (rows.length > 0) return rows;
  } catch (err) {
    logger.warn({ err }, 'FTS search failed, falling back to recent memories');
  }

  // Fallback: return most recent important memories
  return query<StoryMemory>(
    `SELECT * FROM story_memories WHERE story_id = $1
     ORDER BY importance DESC, created_at DESC LIMIT $2`,
    [storyId, limit],
  );
}
