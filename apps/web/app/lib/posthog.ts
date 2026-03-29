import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false, // We handle this manually with router
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
  });

  initialized = true;
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, properties);
}

export function resetUser() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

export function captureEvent(event: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

export function capturePageView(url: string) {
  if (!POSTHOG_KEY) return;
  posthog.capture('$pageview', { $current_url: url });
}

export { posthog };
