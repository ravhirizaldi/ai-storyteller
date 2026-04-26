import { v4 as uuidv4 } from 'uuid';

/** Generate a new UUID v4 */
export function newId(): string {
  return uuidv4();
}
