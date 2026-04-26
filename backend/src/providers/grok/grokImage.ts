import { getGrokClient } from './grokClient';
import { logger } from '../../lib/logger';

export interface ImageGenerationInput {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';
  resolution?: '1k' | '2k';
  n?: number;
}

export interface ImageResult {
  url: string | null;
  b64Json: string | null;
  revisedPrompt: string | null;
}

/**
 * Generate images using xAI's grok-imagine-image model.
 * Images are returned as temporary URLs — download promptly.
 */
export async function generateImage(input: ImageGenerationInput): Promise<ImageResult[]> {
  const client = getGrokClient();

  logger.debug({ prompt: input.prompt.slice(0, 60) }, 'Image generation start');

  const response = await client.images.generate({
    model: 'grok-imagine-image',
    prompt: input.prompt,
    n: input.n ?? 1,
    // xAI-specific parameters via extra body
    // @ts-expect-error xAI-specific parameters
    aspect_ratio: input.aspectRatio ?? '1:1',
    resolution: input.resolution ?? '1k',
  });

  logger.debug('Image generation end');

  return (response.data || []).map((img) => ({
    url: img.url ?? null,
    b64Json: img.b64_json ?? null,
    revisedPrompt: img.revised_prompt ?? null,
  }));
}
