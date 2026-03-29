import Anthropic from '@anthropic-ai/sdk';
import { createTool } from '@mastra/core';
import { z } from 'zod';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Lazily-initialized singleton Anthropic client.
 * Created on first use so that missing API keys don't blow up at import time.
 */
let _client: Anthropic | null = null;

function getClient(apiKey: string): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const claudeTool = createTool({
  id: 'claude-analyze',
  description: 'Analyze text using Claude for structured extraction or generation',
  inputSchema: z.object({
    prompt: z.string().describe('The prompt to send to Claude'),
    systemPrompt: z.string().optional().describe('Optional system prompt'),
    model: z
      .string()
      .optional()
      .default(DEFAULT_MODEL)
      .describe('Anthropic model ID to use (defaults to claude-sonnet-4-20250514)'),
    maxTokens: z.number().optional().default(4096),
    temperature: z.number().optional().default(0.3),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string(),
    usage: z
      .object({
        inputTokens: z.number(),
        outputTokens: z.number(),
      })
      .optional(),
  }),
  execute: async ({ context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        content: 'ANTHROPIC_API_KEY environment variable is not set',
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }

    try {
      const client = getClient(apiKey);

      const response = await client.messages.create({
        model: context.model ?? DEFAULT_MODEL,
        max_tokens: context.maxTokens ?? 4096,
        temperature: context.temperature ?? 0.3,
        ...(context.systemPrompt ? { system: context.systemPrompt } : {}),
        messages: [
          {
            role: 'user',
            content: context.prompt,
          },
        ],
      });

      // Extract text from the response content blocks
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      return {
        success: true,
        content: textContent,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error: unknown) {
      // Handle specific Anthropic SDK errors
      if (error instanceof Anthropic.APIError) {
        const status = error.status;

        if (status === 401) {
          return {
            success: false,
            content: 'Invalid ANTHROPIC_API_KEY: authentication failed',
            usage: { inputTokens: 0, outputTokens: 0 },
          };
        }

        if (status === 429) {
          return {
            success: false,
            content: 'Rate limit exceeded. Please retry after a short delay.',
            usage: { inputTokens: 0, outputTokens: 0 },
          };
        }

        if (status === 529) {
          return {
            success: false,
            content: 'Anthropic API is temporarily overloaded. Please retry later.',
            usage: { inputTokens: 0, outputTokens: 0 },
          };
        }

        return {
          success: false,
          content: `Anthropic API error (${status}): ${error.message}`,
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      }

      // Generic / unexpected errors
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        content: `Unexpected error: ${message}`,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }
  },
});
