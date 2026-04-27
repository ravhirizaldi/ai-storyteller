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
  applyCompactionCutoff = false,
): Promise<StoryMessage[]> {
  // If the story has been compacted, we need to exclude anything already
  // folded into the summary. We pull the cutoff via a subquery against
  // the stories table so the comparison stays in PostgreSQL at full
  // TIMESTAMPTZ µs precision. Round-tripping the cutoff through a JS
  // Date would truncate to ms and let the last summarized message leak
  // back into the live context.
  const params: unknown[] = [storyId];
  let q = `SELECT * FROM story_messages WHERE story_id = $1`;
  if (applyCompactionCutoff) {
    q += ` AND (
      (SELECT summarized_up_to_created_at FROM stories WHERE id = $1) IS NULL
      OR created_at > (SELECT summarized_up_to_created_at FROM stories WHERE id = $1)
    )`;
  }
  q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  const rows = await query<StoryMessage>(q, params);
  // Return in chronological order
  return rows.reverse();
}

/**
 * Fetch all messages older than (or up to) a given cutoff — used by the
 * compact job to build a single "story so far" summary. Returned in
 * chronological order. `keepLastN` lets the caller preserve the most
 * recent turns OUTSIDE the summary so the stream still has live context.
 */
export async function getMessagesForSummary(
  storyId: string,
  keepLastN: number,
): Promise<StoryMessage[]> {
  // Grab all messages, chop off the tail we want to keep raw.
  const all = await query<StoryMessage>(
    `SELECT * FROM story_messages WHERE story_id = $1 ORDER BY created_at ASC`,
    [storyId],
  );
  if (all.length <= keepLastN) return [];
  return all.slice(0, all.length - keepLastN);
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
 * Update a single message's content in-place. Used by the "edit message"
 * flow in the writer UI. Only `content` is mutable; role, story, and
 * timestamps stay pinned.
 */
export async function updateMessageContent(
  id: string,
  content: string,
): Promise<StoryMessage> {
  const rows = await query<StoryMessage>(
    `UPDATE story_messages SET content = $1 WHERE id = $2 RETURNING *`,
    [content, id],
  );
  const row = rows[0];
  if (!row) throw new NotFoundError("Message", id);
  return row;
}

/**
 * Delete a user message AND its immediately-following assistant reply in
 * a single transaction-ish call. Used by "Delete turn" in the UI so a
 * user can scrub a whole exchange without leaving a dangling half.
 *
 * If `messageId` is NOT a user message, only that single row is removed.
 */
export async function deleteTurnStartingAt(
  storyId: string,
  messageId: string,
): Promise<{ deleted: number }> {
  const anchor = await queryOne<StoryMessage>(
    `SELECT * FROM story_messages WHERE id = $1 AND story_id = $2`,
    [messageId, storyId],
  );
  if (!anchor) throw new NotFoundError("Message", messageId);

  if (anchor.role !== "user") {
    await query(`DELETE FROM story_messages WHERE id = $1`, [anchor.id]);
    return { deleted: 1 };
  }

  // Find the next message (by created_at) and, if it's an assistant reply,
  // drop it together with the anchor. Use a subquery to compare timestamps
  // entirely in Postgres — round-tripping anchor.created_at through the pg
  // driver would truncate sub-millisecond precision and cause the anchor
  // row to match itself, leaving its paired assistant reply behind.
  const next = await queryOne<StoryMessage>(
    `SELECT * FROM story_messages
       WHERE story_id = $1
         AND created_at > (SELECT created_at FROM story_messages WHERE id = $2)
       ORDER BY created_at ASC
       LIMIT 1`,
    [storyId, anchor.id],
  );

  const ids = [anchor.id];
  if (next && next.role === "assistant") ids.push(next.id);

  await query(`DELETE FROM story_messages WHERE id = ANY($1::text[])`, [ids]);
  return { deleted: ids.length };
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
