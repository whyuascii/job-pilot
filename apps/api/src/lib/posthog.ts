import { PostHog } from 'posthog-node';

const POSTHOG_KEY = process.env.VITE_POSTHOG_KEY || process.env.POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      flushAt: 20,
      flushInterval: 10000,
    });
  }
  return client;
}

/**
 * Capture a server-side event in PostHog.
 * No-ops gracefully if PostHog is not configured.
 */
export function capture(userId: string, event: string, properties?: Record<string, unknown>): void {
  const ph = getClient();
  if (!ph) return;
  ph.capture({ distinctId: userId, event, properties });
}

/**
 * Capture an error event with standard properties.
 */
export function captureError(
  userId: string,
  event: string,
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  const message = error instanceof Error ? error.message : String(error);
  capture(userId, event, { ...properties, error: message, success: false });
}

/**
 * Flush pending events. Call on graceful shutdown.
 */
export async function shutdown(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
