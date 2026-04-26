import { query, queryOne } from '../../db/client';
import type { Character } from '../../db/schema';
import { newId } from '../../lib/ids';
import { NotFoundError } from '../../lib/errors';

export async function getCharactersByStory(storyId: string): Promise<Character[]> {
  return query<Character>(
    'SELECT * FROM characters WHERE story_id = $1 ORDER BY created_at ASC',
    [storyId],
  );
}

export async function getCharacterById(id: string): Promise<Character> {
  const ch = await queryOne<Character>('SELECT * FROM characters WHERE id = $1', [id]);
  if (!ch) throw new NotFoundError('Character', id);
  return ch;
}

export interface CreateCharacterInput {
  storyId: string;
  name: string;
  role?: string;
  description?: string;
  personality?: string;
  relationshipNotes?: string;
  currentState?: string;
}

export async function createCharacter(input: CreateCharacterInput): Promise<Character> {
  const id = newId();
  const rows = await query<Character>(
    `INSERT INTO characters (id, story_id, name, role, description, personality,
      relationship_notes, current_state, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING *`,
    [
      id, input.storyId, input.name, input.role ?? null,
      input.description ?? null, input.personality ?? null,
      input.relationshipNotes ?? null, input.currentState ?? null,
    ],
  );
  return rows[0]!;
}

export interface UpdateCharacterInput {
  name?: string;
  role?: string;
  description?: string;
  personality?: string;
  relationshipNotes?: string;
  currentState?: string;
}

export async function updateCharacter(id: string, input: UpdateCharacterInput): Promise<Character> {
  await getCharacterById(id);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    name: 'name', role: 'role', description: 'description',
    personality: 'personality', relationshipNotes: 'relationship_notes',
    currentState: 'current_state',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    const val = (input as Record<string, unknown>)[key];
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }

  if (fields.length === 0) return getCharacterById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const rows = await query<Character>(
    `UPDATE characters SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return rows[0]!;
}

export async function deleteCharacter(id: string): Promise<void> {
  await getCharacterById(id);
  await query('DELETE FROM characters WHERE id = $1', [id]);
}
