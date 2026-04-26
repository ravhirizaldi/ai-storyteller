import type OpenAI from "openai";
import { getGrokClient, GROK_FAST, GROK_REASONING } from "./grokClient";
import { logger } from "../../lib/logger";

export interface TextInput {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model?: "fast" | "reasoning";
  maxTokens?: number;
  temperature?: number;
}

/**
 * Generate text (non-streaming) using the xAI/Grok API.
 * Uses the "fast" model by default — switch to "reasoning" for complex tasks.
 */
export async function generateText(input: TextInput): Promise<string> {
  const client = getGrokClient();
  const model = input.model === "reasoning" ? GROK_REASONING : GROK_FAST;

  logger.debug({ model }, "AI generation start");

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: input.systemPrompt },
    ...input.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: input.maxTokens ?? 4096,
    temperature: input.temperature ?? 0.4,
  });

  const text = response.choices[0]?.message?.content ?? "";
  logger.debug(
    { model, tokens: response.usage?.total_tokens },
    "AI generation end",
  );
  return text;
}
