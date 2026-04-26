import type OpenAI from "openai";
import { getGrokClient, GROK_FAST } from "./grokClient";
import { logger } from "../../lib/logger";
import type { FastifyReply } from "fastify";

export interface StreamInput {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Stream story continuation as Server-Sent Events (SSE).
 * Uses the fast non-reasoning model for low-latency streaming.
 *
 * Sends events in the format:
 *   data: {"chunk": "..."}\n\n
 *   data: [DONE]\n\n
 *
 * On client disconnect we abort the upstream OpenAI stream so we don't keep
 * burning tokens after the user has given up.
 */
export async function streamText(
  input: StreamInput,
  reply: FastifyReply,
): Promise<string> {
  const client = getGrokClient();

  logger.debug("AI streaming start");

  reply.hijack(); // Tell Fastify we are managing the raw stream

  // Set SSE headers & CORS explicitly since we bypass Fastify's onSend hook
  reply.raw.setHeader("Access-Control-Allow-Origin", "*");
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("X-Accel-Buffering", "no");
  reply.raw.flushHeaders(); // Start sending immediately

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: input.systemPrompt },
    ...input.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const controller = new AbortController();
  let clientClosed = false;

  reply.raw.on("close", () => {
    if (!reply.raw.writableEnded) {
      clientClosed = true;
      controller.abort();
    }
  });

  let fullText = "";

  try {
    const stream = await client.chat.completions.create(
      {
        model: GROK_FAST,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: input.maxTokens ?? 1400,
        temperature: input.temperature ?? 0.55,
      },
      { signal: controller.signal },
    );

    for await (const chunk of stream) {
      if (clientClosed) break;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        reply.raw.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`);
      }
    }

    if (!clientClosed) {
      reply.raw.write("data: [DONE]\n\n");
      reply.raw.end();
    }
  } catch (err) {
    // If the client aborted, that's expected — just return whatever we got.
    if (clientClosed) {
      logger.debug("AI streaming aborted by client");
    } else {
      logger.error({ err }, "AI streaming error");
      try {
        reply.raw.write(
          `data: ${JSON.stringify({ error: "stream_failed" })}\n\n`,
        );
        reply.raw.end();
      } catch {
        /* socket already closed */
      }
    }
  }

  logger.debug({ chars: fullText.length }, "AI streaming end");
  return fullText;
}
