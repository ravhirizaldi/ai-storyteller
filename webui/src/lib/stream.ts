import { BASE_URL } from './api'

export interface StreamCallbacks {
  generationOverride?: {
    mode?: string;
    temperature?: number;
    maxOutputTokens?: number;
    sceneLock?: boolean;
    allowTimeSkip?: boolean;
    allowLocationChange?: boolean;
    allowMajorPlotProgress?: boolean;
  };
  onChunk: (chunk: string) => void
  onDone: () => void
  onError: (err: Error) => void
}

/**
 * Connect to the story generation streaming endpoint and invoke callbacks
 * for each text chunk, completion, and errors.
 * Uses the Fetch API with ReadableStream to consume Server-Sent Events.
 */
export async function streamStoryGeneration(
  storyId: string,
  message: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { onChunk, onDone, onError } = callbacks

  try {
    const res = await fetch(`${BASE_URL}/api/stories/${storyId}/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, generationOverride: callbacks.generationOverride }),
    })

    if (!res.ok) {
      let msg = `Server error: ${res.status}`
      try {
        const body = await res.json()
        msg = body.message ?? msg
      } catch {}
      throw new Error(msg)
    }

    if (!res.body) throw new Error('No response body for streaming')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          onDone()
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.chunk) {
            onChunk(parsed.chunk)
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    onDone()
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}
