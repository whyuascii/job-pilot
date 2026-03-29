import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY || typeof window === 'undefined') return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',

    // --- Pageview & Navigation ---
    capture_pageview: false, // We handle this manually with router
    capture_pageleave: true,

    // --- Autocapture ---
    autocapture: true,

    // --- Session Replay ---
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: {
        password: true,
      },
      maskTextSelector: '[data-ph-mask]',
    },

    // --- Heatmaps ---
    enable_heatmaps: true,

    // --- Dead Click Detection ---
    capture_dead_clicks: true,

    // --- Console Log Capture ---
    enable_recording_console_log: true,

    // --- Web Vitals ---
    capture_performance: true,

    // --- Scroll Depth ---
    scroll_depth: true,

    // --- Persistence ---
    persistence: 'localStorage+cookie',

    // --- Error Tracking ---
    on_request_error: (error) => {
      console.warn('[PostHog] Request error:', error);
    },

    // --- Advanced ---
    loaded: (ph) => {
      // Enable debug mode in development
      if (import.meta.env.DEV) {
        ph.debug(false); // set to true to see PostHog debug logs
      }
    },
  });

  // Enable exception autocapture for error tracking
  posthog.on('eventCaptured', () => {
    // no-op - just ensures the event pipeline is active
  });

  initialized = true;
}

/**
 * Identify a user with PostHog. Call after login/signup.
 * Sets rich user properties for segmentation.
 */
export function identifyUser(
  userId: string,
  properties?: {
    email?: string;
    name?: string;
    tenantId?: string;
    createdAt?: string;
    [key: string]: any;
  },
) {
  if (!POSTHOG_KEY) return;

  posthog.identify(userId, {
    ...properties,
    app: 'job-pilot',
  });
}

/**
 * Associate user with a tenant group for B2B analytics.
 */
export function setTenantGroup(tenantId: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.group('tenant', tenantId, properties);
}

/**
 * Reset PostHog user identity on logout.
 * Clears all stored user data and generates a new anonymous ID.
 */
export function resetUser() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

/**
 * Capture a custom event with optional properties.
 */
export function captureEvent(event: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

/**
 * Capture a pageview event — called from router subscriber.
 */
export function capturePageView(url: string) {
  if (!POSTHOG_KEY) return;
  posthog.capture('$pageview', { $current_url: url });
}

/**
 * Check if a feature flag is enabled.
 */
export function isFeatureEnabled(flag: string): boolean {
  if (!POSTHOG_KEY) return false;
  return posthog.isFeatureEnabled(flag) ?? false;
}

/**
 * Get the payload of a feature flag.
 */
export function getFeatureFlag(flag: string): string | boolean | undefined {
  if (!POSTHOG_KEY) return undefined;
  return posthog.getFeatureFlag(flag);
}

/**
 * Get the payload of a feature flag (JSON payloads).
 */
export function getFeatureFlagPayload(flag: string): any {
  if (!POSTHOG_KEY) return undefined;
  return posthog.getFeatureFlagPayload(flag);
}

/**
 * Register super properties that are sent with every event.
 */
export function registerSuperProperties(properties: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.register(properties);
}

/**
 * Set user properties without an identify call.
 * Useful for progressive profiling.
 */
export function setPersonProperties(properties: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.setPersonProperties(properties);
}

export { posthog };
