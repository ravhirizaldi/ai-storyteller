import { query, queryOne } from '../../db/client';
import type { PlotThread } from '../../db/schema';
import { newId } from '../../lib/ids';
import { NotFoundError } from '../../lib/errors';

export async function getPlotThreadsByStory(storyId: string): Promise<PlotThread[]> {
  return query<PlotThread>(
    'SELECT * FROM plot_threads WHERE story_id = $1 ORDER BY status ASC, updated_at DESC',
    [storyId],
  );
}

export async function getActivePlotThreads(storyId: string): Promise<PlotThread[]> {
  return query<PlotThread>(
    `SELECT * FROM plot_threads WHERE story_id = $1 AND status = 'active'
     ORDER BY last_seen_at DESC NULLS LAST`,
    [storyId],
  );
}

export async function getPlotThreadById(id: string): Promise<PlotThread> {
  const pt = await queryOne<PlotThread>('SELECT * FROM plot_threads WHERE id = $1', [id]);
  if (!pt) throw new NotFoundError('PlotThread', id);
  return pt;
}

export interface CreatePlotThreadInput {
  storyId: string;
  title: string;
  content?: string;
  status?: 'active' | 'resolved' | 'dormant';
}

export async function createPlotThread(input: CreatePlotThreadInput): Promise<PlotThread> {
  const id = newId();
  const rows = await query<PlotThread>(
    `INSERT INTO plot_threads (id, story_id, title, status, content, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`,
    [id, input.storyId, input.title, input.status ?? 'active', input.content ?? null],
  );
  return rows[0]!;
}

export interface UpdatePlotThreadInput {
  title?: string;
  status?: 'active' | 'resolved' | 'dormant';
  content?: string;
  lastSeenAt?: Date;
}

export async function updatePlotThread(id: string, input: UpdatePlotThreadInput): Promise<PlotThread> {
  await getPlotThreadById(id);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.title !== undefined) { fields.push(`title = $${idx++}`); values.push(input.title); }
  if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }
  if (input.content !== undefined) { fields.push(`content = $${idx++}`); values.push(input.content); }
  if (input.lastSeenAt !== undefined) { fields.push(`last_seen_at = $${idx++}`); values.push(input.lastSeenAt); }

  if (fields.length === 0) return getPlotThreadById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const rows = await query<PlotThread>(
    `UPDATE plot_threads SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return rows[0]!;
}

export async function deletePlotThread(id: string): Promise<void> {
  await getPlotThreadById(id);
  await query('DELETE FROM plot_threads WHERE id = $1', [id]);
}
