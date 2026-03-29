/**
 * Sanitize user input to prevent XSS.
 * Strips HTML tags from text input and normalizes whitespace.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/javascript:/gi, '') // Strip javascript: URIs
    .replace(/on\w+\s*=/gi, '') // Strip event handlers
    .trim();
}

/**
 * Sanitize a URL to ensure it's safe.
 */
export function sanitizeUrl(input: string): string {
  const trimmed = input.trim();
  // Only allow http:// and https:// URLs
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Invalid URL: must start with http:// or https://');
  }
  return trimmed;
}
