const BASE_URL = import.meta.env.VITE_API_BASE_URL === 'http://localhost:4000' ? '' : (import.meta.env.VITE_API_BASE_URL || '')

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`
  
  const headers = new Headers(options.headers)
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  } else {
    headers.delete('Content-Type')
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let errorBody: { error?: string; message?: string } = {}
    try {
      errorBody = await res.json()
    } catch {}
    throw new ApiError(res.status, errorBody.error ?? 'ERROR', errorBody.message ?? res.statusText)
  }

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ─── Types ───────────────────────────────────────────────
export interface Story {
  id: string
  title: string
  genre: string | null
  language: string
  system_prompt: string | null
  style_prompt: string | null
  story_bible: string | null
  current_scene_state: string | null
  current_timeline_state: string | null
  generation_mode: string
  temperature: number
  max_output_tokens: number
  scene_lock: boolean
  allow_time_skip: boolean
  allow_location_change: boolean
  allow_major_plot_progress: boolean
  created_at: string
  updated_at: string
}

export interface StoryMessage {
  id: string
  story_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  token_count: number | null
  created_at: string
}

export interface Character {
  id: string
  story_id: string
  name: string
  role: string | null
  description: string | null
  personality: string | null
  relationship_notes: string | null
  current_state: string | null
  created_at: string
  updated_at: string
}

export interface StoryMemory {
  id: string
  story_id: string
  type: string
  content: string
  importance: number
  source_message_id: string | null
  created_at: string
}

export interface PlotThread {
  id: string
  story_id: string
  title: string
  status: 'active' | 'resolved' | 'dormant'
  content: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

// ─── Stories ────────────────────────────────────────────
export const storiesApi = {
  list: () => request<Story[]>('/api/stories'),
  get: (id: string) => request<Story>(`/api/stories/${id}`),
  create: (data: Partial<Story> & { title: string }) =>
    request<Story>('/api/stories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Story>) =>
    request<Story>(`/api/stories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/stories/${id}`, { method: 'DELETE' }),
  resetProgress: (id: string) => request<void>(`/api/stories/${id}/reset`, { method: 'POST' }),
}

// ─── Messages ───────────────────────────────────────────
export const messagesApi = {
  list: async (storyId: string, cursor?: string) => {
    const url = new URL(`${BASE_URL}/api/stories/${storyId}/messages`, window.location.origin)
    if (cursor) url.searchParams.append('cursor', cursor)
    return request<StoryMessage[]>(url.pathname + url.search)
  },
  generate: (storyId: string, message: string) =>
    request<{ content: string; userMessageId: string; assistantMessageId: string }>(
      `/api/stories/${storyId}/generate`,
      { method: 'POST', body: JSON.stringify({ message }) },
    ),
}

// ─── Characters ─────────────────────────────────────────
export const charactersApi = {
  list: (storyId: string) => request<Character[]>(`/api/stories/${storyId}/characters`),
  create: (storyId: string, data: Omit<Character, 'id' | 'story_id' | 'created_at' | 'updated_at'>) =>
    request<Character>(`/api/stories/${storyId}/characters`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Character>) =>
    request<Character>(`/api/characters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/characters/${id}`, { method: 'DELETE' }),
}

// ─── Memories ───────────────────────────────────────────
export const memoriesApi = {
  list: (storyId: string) => request<StoryMemory[]>(`/api/stories/${storyId}/memories`),
  create: (storyId: string, data: { type: string; content: string; importance?: number }) =>
    request<StoryMemory>(`/api/stories/${storyId}/memories`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/memories/${id}`, { method: 'DELETE' }),
}

// ─── Plot Threads ────────────────────────────────────────
export const plotThreadsApi = {
  list: (storyId: string) => request<PlotThread[]>(`/api/stories/${storyId}/plot-threads`),
  create: (storyId: string, data: { title: string; content?: string; status?: string }) =>
    request<PlotThread>(`/api/stories/${storyId}/plot-threads`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<PlotThread>) =>
    request<PlotThread>(`/api/plot-threads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/plot-threads/${id}`, { method: 'DELETE' }),
}

// ─── Image Generation ────────────────────────────────────
export const imagesApi = {
  generate: (
    storyId: string,
    data: { prompt: string; aspectRatio?: string; resolution?: string },
  ) =>
    request<{ images: Array<{ url: string | null; b64Json: string | null }> }>(
      `/api/stories/${storyId}/images/generate`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
}

export { ApiError, BASE_URL }
