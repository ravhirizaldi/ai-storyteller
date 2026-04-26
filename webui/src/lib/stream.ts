import { BASE_URL } from "./api";

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
  /** Optional AbortSignal — aborts the fetch and the upstream model stream. */
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  /** Called when the server signals [DONE] or the stream closes cleanly. */
  onDone: () => void;
  onError: (err: Error) => void;
  /** Called when the client aborts the stream. */
  onAbort?: () => void;
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
  const { onChunk, onDone, onError, onAbort, signal } = callbacks;

  try {
    const res = await fetch(
      `${BASE_URL}/api/stories/${storyId}/generate/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          generationOverride: callbacks.generationOverride,
        }),
        signal,
      },
    );

    if (!res.ok) {
      let msg = `Server error: ${res.status}`;
      try {
        const body = await res.json();
        msg = body.message ?? msg;
      } catch {}
      throw new Error(msg);
    }

    if (!res.body) throw new Error("No response body for streaming");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          onDone();
          return;
        }
        let parsed: { chunk?: string; error?: string } | null = null;
        try {
          parsed = JSON.parse(data) as { chunk?: string; error?: string };
        } catch {
          // Skip malformed lines
          continue;
        }
        if (parsed.chunk) {
          onChunk(parsed.chunk);
        } else if (parsed.error) {
          throw new Error(
            parsed.error === "stream_failed"
              ? "Generation failed on the server."
              : String(parsed.error),
          );
        }
      }
    }

    onDone();
  } catch (err) {
    // AbortError is expected when the user stops generation.
    if (err instanceof DOMException && err.name === "AbortError") {
      onAbort?.();
      return;
    }
    if (err instanceof Error && err.name === "AbortError") {
      onAbort?.();
      return;
    }
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
