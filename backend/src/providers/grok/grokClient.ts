import OpenAI from 'openai';
import { env } from '../../config/env';
import { ConfigurationError } from '../../lib/errors';

/** Singleton OpenAI client pointed at the xAI API */
let _client: OpenAI | null = null;

export function getGrokClient(): OpenAI {
  if (!env.XAI_API_KEY) {
    throw new ConfigurationError(
      'XAI_API_KEY is not set. Please add it to your backend/.env file.',
    );
  }
  if (!_client) {
    _client = new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
      timeout: 360_000, // 6 minutes — required for reasoning models
    });
  }
  return _client;
}

/** Model names */
export const GROK_FAST = 'grok-4-1-fast-non-reasoning';
export const GROK_REASONING = 'grok-4-1-fast-reasoning';
