/**
 * Document Parser Tool
 *
 * Parses documents (PDF, text) using Claude's vision API for PDFs
 * and text extraction for plain text files. Used for resume parsing.
 *
 * @version 1.0.0
 */
import Anthropic from '@anthropic-ai/sdk';
import { createTool } from '@mastra/core';
import { z } from 'zod';

import { RESUME_PARSER_PDF_INSTRUCTION, RESUME_PARSER_PROMPT } from '../prompts/resume-parser.js';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export const documentParserTool = createTool({
  id: 'document-parser',
  description: 'Parse a document (PDF or text) using Claude AI to extract structured data',
  inputSchema: z.object({
    content: z.string().describe('Base64-encoded PDF data OR plain text content'),
    contentType: z
      .enum(['application/pdf', 'text/plain', 'text/html'])
      .describe('MIME type of the content'),
    systemPrompt: z.string().optional().describe('Override the default parsing prompt'),
    model: z.string().optional().default(DEFAULT_MODEL),
    maxTokens: z.number().optional().default(4096),
    apiKey: z.string().describe('Anthropic API key'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string().describe('Raw JSON string response from Claude'),
    usage: z
      .object({
        inputTokens: z.number(),
        outputTokens: z.number(),
      })
      .optional(),
    latencyMs: z.number().optional(),
  }),
  execute: async ({ context }) => {
    const { content, contentType, apiKey, model = DEFAULT_MODEL, maxTokens = 4096 } = context;
    const systemPrompt = context.systemPrompt || RESUME_PARSER_PROMPT;

    if (!apiKey) {
      return {
        success: false,
        content: 'API key is required',
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      const client = new Anthropic({ apiKey });

      let messageContent: Anthropic.MessageCreateParams['messages'][0]['content'];

      if (contentType === 'application/pdf') {
        // PDF: use Claude's document vision API with base64
        if (!content || content.length < 100) {
          return {
            success: false,
            content: 'PDF content appears to be empty',
            usage: { inputTokens: 0, outputTokens: 0 },
            latencyMs: Date.now() - startTime,
          };
        }

        messageContent = [
          {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: content,
            },
          },
          { type: 'text' as const, text: RESUME_PARSER_PDF_INSTRUCTION },
        ];
      } else {
        // Plain text or HTML
        const textContent = content.trim();
        if (!textContent || textContent.length < 20) {
          return {
            success: false,
            content: 'Document content appears to be empty',
            usage: { inputTokens: 0, outputTokens: 0 },
            latencyMs: Date.now() - startTime,
          };
        }
        messageContent = `Parse this resume:\n\n${textContent}`;
      }

      const message = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: messageContent }],
      });

      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        success: true,
        content: responseText,
        usage: {
          inputTokens: message.usage?.input_tokens ?? 0,
          outputTokens: message.usage?.output_tokens ?? 0,
        },
        latencyMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      if (error instanceof Anthropic.APIError) {
        const status = error.status;
        if (status === 401)
          return {
            success: false,
            content: 'Invalid API key',
            usage: { inputTokens: 0, outputTokens: 0 },
            latencyMs: Date.now() - startTime,
          };
        if (status === 429)
          return {
            success: false,
            content: 'Rate limit exceeded',
            usage: { inputTokens: 0, outputTokens: 0 },
            latencyMs: Date.now() - startTime,
          };
        return {
          success: false,
          content: `API error (${status}): ${error.message}`,
          usage: { inputTokens: 0, outputTokens: 0 },
          latencyMs: Date.now() - startTime,
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        content: `Unexpected error: ${message}`,
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: Date.now() - startTime,
      };
    }
  },
});
