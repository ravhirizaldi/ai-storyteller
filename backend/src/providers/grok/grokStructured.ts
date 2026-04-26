import { getGrokClient, GROK_REASONING } from './grokClient';
import { logger } from '../../lib/logger';

export interface StructuredInput {
  systemPrompt: string;
  userPrompt: string;
  schema: Record<string, unknown>;
  schemaName: string;
  temperature?: number;
}

/**
 * Generate structured JSON output using xAI's response_format feature.
 * Always uses the reasoning model — this is for complex analysis tasks.
 */
export async function generateStructured<T>(input: StructuredInput): Promise<T> {
  const client = getGrokClient();

  logger.debug({ schema: input.schemaName }, 'Structured AI generation start');

  const response = await client.chat.completions.create({
    model: GROK_REASONING,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: input.schemaName,
        strict: true,
        schema: input.schema,
      },
    },
    max_tokens: 4096,
    temperature: input.temperature ?? 0.2,
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  logger.debug({ schema: input.schemaName }, 'Structured AI generation end');

  return JSON.parse(content) as T;
}
