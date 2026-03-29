import { createAuthClient } from 'better-auth/react';

// In production the API lives at a separate origin (api.job-pilot.whyuascii.com).
// VITE_API_URL is set at build time; in dev Vite proxies /api to localhost:3001.
const apiBase = (import.meta as any).env?.VITE_API_URL || window.location.origin;

export const authClient = createAuthClient({
  baseURL: apiBase,
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
