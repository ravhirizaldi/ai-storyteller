/** Client-side ID for optimistic updates */
export function newId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
