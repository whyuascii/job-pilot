import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { gmailTokens, recruiterMessages } from '@job-pilot/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTenantContext } from '~/lib/api';
import { encrypt, decrypt } from '~/lib/crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ');

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.',
    );
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Refresh an expired access token using the stored refresh token.
 * Returns the new access token and updates the DB record.
 */
async function refreshAccessToken(tokenRecord: {
  id: string;
  refreshToken: string;
}): Promise<string> {
  const { clientId, clientSecret } = getOAuthConfig();
  const decryptedRefreshToken = await decrypt(tokenRecord.refreshToken);

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptedRefreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Gmail token: ${error}`);
  }

  const data = await response.json();
  const encryptedAccessToken = await encrypt(data.access_token);
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db
    .update(gmailTokens)
    .set({
      accessToken: encryptedAccessToken,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(gmailTokens.id, tokenRecord.id));

  return data.access_token as string;
}

/**
 * Get a valid access token for making Gmail API calls.
 * Refreshes automatically if expired.
 */
async function getValidAccessToken(tokenRecord: {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}): Promise<string> {
  // Refresh if token expires within 5 minutes
  const bufferMs = 5 * 60 * 1000;
  if (new Date(tokenRecord.expiresAt).getTime() - Date.now() < bufferMs) {
    return refreshAccessToken(tokenRecord);
  }

  return decrypt(tokenRecord.accessToken);
}

// ---------------------------------------------------------------------------
// Server Functions
// ---------------------------------------------------------------------------

/**
 * Generate the Google OAuth2 authorization URL.
 * The user will be redirected to this URL to grant Gmail access.
 */
export const getGmailAuthUrl = createServerFn({ method: 'GET' }).handler(async () => {
  await getTenantContext(); // ensure authenticated

  const { clientId, redirectUri } = getOAuthConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });

  return { url: `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}` };
});

/**
 * Exchange an authorization code for access/refresh tokens.
 * Encrypts and stores the tokens in the database.
 */
export const handleGmailCallback = createServerFn({ method: 'POST' }).validator(
  (data: { code: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  // Exchange the authorization code for tokens
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: data.code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange Gmail auth code: ${error}`);
  }

  const tokenData = await response.json();

  if (!tokenData.refresh_token) {
    throw new Error(
      'No refresh token received. This can happen if you previously connected Gmail. Try revoking access at https://myaccount.google.com/permissions and reconnecting.',
    );
  }

  // Encrypt tokens before storage
  const encryptedAccessToken = await encrypt(tokenData.access_token);
  const encryptedRefreshToken = await encrypt(tokenData.refresh_token);
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  // Upsert: delete any existing token for this user, then insert
  await db
    .delete(gmailTokens)
    .where(
      and(
        eq(gmailTokens.tenantId, ctx.tenantId),
        eq(gmailTokens.userId, ctx.userId),
      ),
    );

  await db.insert(gmailTokens).values({
    id: createId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    accessToken: encryptedAccessToken,
    refreshToken: encryptedRefreshToken,
    scope: tokenData.scope || GMAIL_SCOPES,
    expiresAt,
  });

  return { success: true };
});

/**
 * Check whether Gmail is connected for the current user.
 */
export const getGmailStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  const token = await db.query.gmailTokens.findFirst({
    where: and(
      eq(gmailTokens.tenantId, ctx.tenantId),
      eq(gmailTokens.userId, ctx.userId),
    ),
  });

  if (!token) {
    return { connected: false as const };
  }

  return {
    connected: true as const,
    scope: token.scope,
    connectedAt: token.createdAt,
  };
});

/**
 * Disconnect Gmail by removing stored tokens.
 */
export const disconnectGmail = createServerFn({ method: 'POST' }).handler(async () => {
  const ctx = await getTenantContext();

  // Optionally revoke the token at Google first
  const token = await db.query.gmailTokens.findFirst({
    where: and(
      eq(gmailTokens.tenantId, ctx.tenantId),
      eq(gmailTokens.userId, ctx.userId),
    ),
  });

  if (token) {
    try {
      const accessToken = await decrypt(token.accessToken);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      // Revocation is best-effort; continue with deletion
    }
  }

  await db
    .delete(gmailTokens)
    .where(
      and(
        eq(gmailTokens.tenantId, ctx.tenantId),
        eq(gmailTokens.userId, ctx.userId),
      ),
    );

  return { success: true };
});

// ---------------------------------------------------------------------------
// Email Sync
// ---------------------------------------------------------------------------

/** Recruiter-related search query for Gmail */
const RECRUITER_QUERY = [
  'subject:(opportunity OR position OR role OR hiring OR interview OR application OR recruiter OR recruitment)',
  'newer_than:7d',
  '-category:promotions',
  '-category:social',
].join(' ');

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
    }>;
  };
  snippet: string;
  internalDate: string;
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractBody(payload: GmailMessageDetail['payload']): string {
  // Try plain text body first
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Look through parts for text/plain
  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return decodeBase64Url(textPart.body.data);
    }

    // Fall back to text/html
    const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return decodeBase64Url(htmlPart.body.data);
    }
  }

  return '';
}

/**
 * Fetch recent emails matching recruiter patterns and store them.
 * Returns a summary of how many messages were synced.
 */
export const syncRecruitMessages = createServerFn({ method: 'POST' }).handler(async () => {
  const ctx = await getTenantContext();

  // 1. Get the stored token
  const tokenRecord = await db.query.gmailTokens.findFirst({
    where: and(
      eq(gmailTokens.tenantId, ctx.tenantId),
      eq(gmailTokens.userId, ctx.userId),
    ),
  });

  if (!tokenRecord) {
    throw new Error('Gmail is not connected. Connect Gmail first in Settings.');
  }

  // 2. Get a valid access token (auto-refreshes if expired)
  const accessToken = await getValidAccessToken(tokenRecord);

  // 3. Search for recruiter-related messages
  const searchParams = new URLSearchParams({
    q: RECRUITER_QUERY,
    maxResults: '25',
  });

  const listResponse = await fetch(`${GMAIL_API_BASE}/messages?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    const error = await listResponse.text();
    throw new Error(`Failed to search Gmail: ${error}`);
  }

  const listData = await listResponse.json();
  const messages: GmailMessage[] = listData.messages || [];

  if (messages.length === 0) {
    return { synced: 0, skipped: 0, total: 0 };
  }

  // 4. Fetch full details for each message and store new ones
  let synced = 0;
  let skipped = 0;

  for (const msg of messages) {
    // Check if we already have this message
    const existing = await db.query.recruiterMessages.findFirst({
      where: and(
        eq(recruiterMessages.tenantId, ctx.tenantId),
        eq(recruiterMessages.externalId, msg.id),
      ),
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Fetch full message details
    const detailResponse = await fetch(`${GMAIL_API_BASE}/messages/${msg.id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!detailResponse.ok) {
      continue; // Skip messages we can't fetch
    }

    const detail: GmailMessageDetail = await detailResponse.json();
    const headers = detail.payload.headers;
    const from = getHeader(headers, 'From');
    const subject = getHeader(headers, 'Subject');
    const body = extractBody(detail.payload);
    const receivedAt = new Date(parseInt(detail.internalDate, 10));

    await db.insert(recruiterMessages).values({
      id: createId(),
      tenantId: ctx.tenantId,
      externalId: msg.id,
      from,
      subject: subject || '(no subject)',
      body: body || detail.snippet || '',
      receivedAt,
    });

    synced++;
  }

  return { synced, skipped, total: messages.length };
});
