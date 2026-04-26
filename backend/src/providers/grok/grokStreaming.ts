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
  reply.raw.setHeader("Cache-Control", "no-cache");
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

  const stream = await client.chat.completions.create({
    model: GROK_FAST,
    messages,
    stream: true,
    max_tokens: input.maxTokens ?? 4096,
    temperature: input.temperature ?? 0.4,
  });

  let fullText = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      reply.raw.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`);
    }
  }

  reply.raw.write("data: [DONE]\n\n");
  reply.raw.end();

  logger.debug("AI streaming end");
  return fullText;
}
