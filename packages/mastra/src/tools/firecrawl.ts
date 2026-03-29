import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * Strips HTML tags from a string, collapses whitespace, and returns plain text.
 * Uses a simple regex-based approach with no heavy dependencies.
 */
function stripHtml(html: string): string {
  return (
    html
      // Remove <script> and <style> blocks entirely (including their content)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Replace <br>, <p>, <div>, <li>, <tr>, heading, and <hr> tags with newlines for readability
      .replace(/<(?:br|p|div|li|tr|h[1-6]|hr)\b[^>]*\/?>/gi, '\n')
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode common HTML entities
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&#x2F;/gi, '/')
      // Collapse multiple whitespace characters (spaces/tabs) on the same line into one space
      .replace(/[^\S\n]+/g, ' ')
      // Collapse 3+ consecutive newlines into 2
      .replace(/\n{3,}/g, '\n\n')
      // Trim each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
  );
}

/**
 * Uses Claude (via @anthropic-ai/sdk) to extract the main job posting content
 * from raw page text, removing navigation, footers, ads, and other noise.
 */
async function extractWithClaude(rawText: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env automatically

  // Truncate very large pages to stay within context limits (roughly 100k chars)
  const truncated = rawText.length > 100_000 ? rawText.slice(0, 100_000) : rawText;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Extract the main job posting content from this web page text. Remove navigation, footers, ads, and other non-job content. Return only the job description, requirements, and company information as clean text.\n\n---\n\n${truncated}`,
      },
    ],
  });

  // Extract text from the response content blocks
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('\n');
}

/**
 * Web scraper tool that replaces Firecrawl with a plain fetch() + Claude approach.
 *
 * 1. Uses native fetch() to download HTML from a URL
 * 2. Strips HTML tags to get raw text (regex-based, no heavy deps)
 * 3. If ANTHROPIC_API_KEY is available, uses Claude to extract the main job content
 * 4. Falls back to returning the stripped text if no API key
 * 5. Handles network failures, timeouts, non-200 responses, and invalid URLs
 */
export const webScraperTool = createTool({
  id: 'web-scraper',
  description:
    'Scrape a web page and extract the main content using fetch() and Claude for intelligent extraction',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to scrape'),
    timeout: z
      .number()
      .int()
      .positive()
      .default(15000)
      .describe('Request timeout in milliseconds (default: 15000)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string(),
    metadata: z.record(z.unknown()),
  }),
  execute: async ({ context }: { context: { url: string; timeout?: number } }) => {
    const { url, timeout = 15000 } = context;

    // --- Validate URL ---
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          success: false,
          content: '',
          metadata: { error: `Unsupported protocol: ${parsedUrl.protocol}` },
        };
      }
    } catch {
      return {
        success: false,
        content: '',
        metadata: { error: `Invalid URL: ${url}` },
      };
    }

    // --- Fetch the page with a timeout ---
    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      response = await fetch(parsedUrl.href, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; JobPilotBot/1.0; +https://github.com/job-pilot)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      clearTimeout(timer);
    } catch (err: unknown) {
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? `Request timed out after ${timeout}ms`
          : err instanceof Error
            ? err.message
            : 'Unknown fetch error';
      return {
        success: false,
        content: '',
        metadata: { error: `Network error: ${message}` },
      };
    }

    // --- Check HTTP status ---
    if (!response.ok) {
      return {
        success: false,
        content: '',
        metadata: {
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        },
      };
    }

    // --- Read and strip HTML ---
    let html: string;
    try {
      html = await response.text();
    } catch (err: unknown) {
      return {
        success: false,
        content: '',
        metadata: {
          error: `Failed to read response body: ${err instanceof Error ? err.message : 'unknown error'}`,
        },
      };
    }

    const rawText = stripHtml(html);

    if (!rawText) {
      return {
        success: false,
        content: '',
        metadata: { error: 'Page returned empty content after stripping HTML' },
      };
    }

    // --- Extract with Claude if ANTHROPIC_API_KEY is available ---
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        const extracted = await extractWithClaude(rawText);
        return {
          success: true,
          content: extracted,
          metadata: {
            source: url,
            extractedWith: 'claude',
            rawTextLength: rawText.length,
          },
        };
      } catch (err: unknown) {
        // If Claude extraction fails, fall back to raw text
        return {
          success: true,
          content: rawText,
          metadata: {
            source: url,
            extractedWith: 'fallback-raw',
            rawTextLength: rawText.length,
            claudeError: err instanceof Error ? err.message : 'Unknown Claude API error',
          },
        };
      }
    }

    // --- No API key: return stripped text as-is ---
    return {
      success: true,
      content: rawText,
      metadata: {
        source: url,
        extractedWith: 'raw-strip',
        rawTextLength: rawText.length,
      },
    };
  },
});

/**
 * Backwards-compatible alias. Consumers importing `firecrawlTool` will get
 * the new web-scraper implementation transparently.
 */
export const firecrawlTool = webScraperTool;
