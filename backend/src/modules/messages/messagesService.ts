import { query, queryOne } from "../../db/client";
import type { StoryMessage } from "../../db/schema";
import { newId } from "../../lib/ids";
import { NotFoundError } from "../../lib/errors";

export async function getMessagesByStory(
  storyId: string,
  limit = 50,
  cursor?: string,
): Promise<StoryMessage[]> {
  let q = `SELECT * FROM story_messages WHERE story_id = $1`;
  const params: any[] = [storyId];

  if (cursor) {
    q += ` AND created_at < (SELECT created_at FROM story_messages WHERE id = $2)`;
    params.push(cursor);
  }

  q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const rows = await query<StoryMessage>(q, params);
  return rows.reverse();
}

export async function getRecentMessages(
  storyId: string,
  limit = 12,
): Promise<StoryMessage[]> {
  const rows = await query<StoryMessage>(
    `SELECT * FROM story_messages WHERE story_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [storyId, limit],
  );
  // Return in chronological order
  return rows.reverse();
}

export interface CreateMessageInput {
  storyId: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokenCount?: number;
}

export async function createMessage(
  input: CreateMessageInput,
): Promise<StoryMessage> {
  const id = newId();
  const rows = await query<StoryMessage>(
    `INSERT INTO story_messages (id, story_id, role, content, token_count, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
    [id, input.storyId, input.role, input.content, input.tokenCount ?? null],
  );
  return rows[0]!;
}

export async function getMessageById(id: string): Promise<StoryMessage> {
  const msg = await queryOne<StoryMessage>(
    "SELECT * FROM story_messages WHERE id = $1",
    [id],
  );
  if (!msg) throw new NotFoundError("Message", id);
  return msg;
}

/**
 * Delete the trailing assistant reply and its preceding user message for a story.
 * Used by the regenerate flow so we don't pile up duplicate turns in the DB.
 * No-op if the tail isn't a (user, assistant) pair.
 */
export async function deleteLastExchange(
  storyId: string,
): Promise<{ deleted: number }> {
  const tail = await query<StoryMessage>(
    `SELECT * FROM story_messages
       WHERE story_id = $1
       ORDER BY created_at DESC
       LIMIT 2`,
    [storyId],
  );

  if (tail.length < 2) return { deleted: 0 };
  const [assistant, user] = tail;
  if (!assistant || !user) return { deleted: 0 };
  if (assistant.role !== "assistant" || user.role !== "user") {
    return { deleted: 0 };
  }

  await query(`DELETE FROM story_messages WHERE id = ANY($1::text[])`, [
    [assistant.id, user.id],
  ]);
  return { deleted: 2 };
}
