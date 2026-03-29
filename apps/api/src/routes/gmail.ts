import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { gmailTokens, recruiterMessages } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';
import { decrypt, encrypt } from '../lib/crypto.js';

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
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Gmail OAuth is not configured.');
  return { clientId, clientSecret, redirectUri };
}

async function refreshAccessToken(tokenRecord: { id: string; refreshToken: string }) {
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
  if (!response.ok) throw new Error(`Failed to refresh Gmail token: ${await response.text()}`);
  const data = await response.json();
  const encryptedAccessToken = await encrypt(data.access_token);
  await db
    .update(gmailTokens)
    .set({
      accessToken: encryptedAccessToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(gmailTokens.id, tokenRecord.id));
  return data.access_token as string;
}

async function getValidAccessToken(tokenRecord: {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}) {
  if (new Date(tokenRecord.expiresAt).getTime() - Date.now() < 5 * 60 * 1000)
    return refreshAccessToken(tokenRecord);
  return decrypt(tokenRecord.accessToken);
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function decodeBase64Url(encoded: string): string {
  return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload: any): string {
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  if (payload.parts) {
    const text = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (text?.body?.data) return decodeBase64Url(text.body.data);
    const html = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (html?.body?.data) return decodeBase64Url(html.body.data);
  }
  return '';
}

const router = Router();

router.get('/auth-url', async (_req, res, next) => {
  try {
    getTenantContext();
    const config = getOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    });
    res.json({ url: `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}` });
  } catch (e) {
    // Return a user-friendly JSON error for missing OAuth config
    if (e instanceof Error && e.message.includes('not configured')) {
      res.status(400).json({
        error:
          'Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your environment.',
      });
      return;
    }
    next(e);
  }
});

router.post('/callback', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { clientId, clientSecret, redirectUri } = getOAuthConfig();
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: req.body.code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    if (!response.ok)
      throw new Error(`Failed to exchange Gmail auth code: ${await response.text()}`);
    const tokenData = await response.json();
    if (!tokenData.refresh_token) throw new Error('No refresh token received.');
    const encryptedAccessToken = await encrypt(tokenData.access_token);
    const encryptedRefreshToken = await encrypt(tokenData.refresh_token);
    await db
      .delete(gmailTokens)
      .where(and(eq(gmailTokens.tenantId, ctx.tenantId), eq(gmailTokens.userId, ctx.userId)));
    await db.insert(gmailTokens).values({
      id: createId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      scope: tokenData.scope || GMAIL_SCOPES,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.get('/status', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const token = await db.query.gmailTokens.findFirst({
      where: and(eq(gmailTokens.tenantId, ctx.tenantId), eq(gmailTokens.userId, ctx.userId)),
    });
    if (!token) {
      res.json({ connected: false });
      return;
    }
    res.json({ connected: true, scope: token.scope, connectedAt: token.createdAt });
  } catch (e) {
    next(e);
  }
});

router.post('/disconnect', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const token = await db.query.gmailTokens.findFirst({
      where: and(eq(gmailTokens.tenantId, ctx.tenantId), eq(gmailTokens.userId, ctx.userId)),
    });
    if (token) {
      try {
        const at = await decrypt(token.accessToken);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${at}`, { method: 'POST' });
      } catch {}
    }
    await db
      .delete(gmailTokens)
      .where(and(eq(gmailTokens.tenantId, ctx.tenantId), eq(gmailTokens.userId, ctx.userId)));
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.post('/sync-messages', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const tokenRecord = await db.query.gmailTokens.findFirst({
      where: and(eq(gmailTokens.tenantId, ctx.tenantId), eq(gmailTokens.userId, ctx.userId)),
    });
    if (!tokenRecord) throw new Error('Gmail is not connected.');
    const accessToken = await getValidAccessToken(tokenRecord);
    const query = [
      'subject:(opportunity OR position OR role OR hiring OR interview OR application OR recruiter)',
      'newer_than:7d',
      '-category:promotions',
      '-category:social',
    ].join(' ');
    const listResponse = await fetch(
      `${GMAIL_API_BASE}/messages?${new URLSearchParams({ q: query, maxResults: '25' })}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listResponse.ok) throw new Error(`Failed to search Gmail: ${await listResponse.text()}`);
    const messages = (await listResponse.json()).messages || [];
    let synced = 0,
      skipped = 0;
    for (const msg of messages) {
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
      const detail = await fetch(`${GMAIL_API_BASE}/messages/${msg.id}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!detail.ok) continue;
      const d = await detail.json();
      await db.insert(recruiterMessages).values({
        id: createId(),
        tenantId: ctx.tenantId,
        externalId: msg.id,
        from: getHeader(d.payload.headers, 'From'),
        subject: getHeader(d.payload.headers, 'Subject') || '(no subject)',
        body: extractBody(d.payload) || d.snippet || '',
        receivedAt: new Date(parseInt(d.internalDate, 10)),
      });
      synced++;
    }
    res.json({ synced, skipped, total: messages.length });
  } catch (e) {
    next(e);
  }
});

// GET /api/gmail/templates
router.get('/templates', async (_req, res, next) => {
  try {
    getTenantContext();
    const { EMAIL_TEMPLATES } = await import('../lib/email-templates.js');
    res.json(EMAIL_TEMPLATES);
  } catch (e) {
    next(e);
  }
});

// POST /api/gmail/send
router.post('/send', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { to, subject, body, applicationId, templateType } = req.body;
    if (!to || !subject || !body) throw new Error('to, subject, and body are required');

    // Get Gmail token
    const tokenRecord = await db.query.gmailTokens.findFirst({
      where: and(eq(gmailTokens.tenantId, ctx.tenantId), eq(gmailTokens.userId, ctx.userId)),
    });
    if (!tokenRecord) throw new Error('Gmail is not connected. Please connect Gmail in settings.');

    // Check send scope
    if (!tokenRecord.scope?.includes('gmail.send')) {
      throw new Error(
        'Gmail send permission not granted. Please reconnect Gmail with send permission.',
      );
    }

    const accessToken = await getValidAccessToken(tokenRecord);

    // Build RFC 2822 message
    const { candidates: candidatesTable, sentEmails } = await import('@job-pilot/db/schema');
    const candidate = await db.query.candidates.findFirst({
      where: and(
        eq(candidatesTable.tenantId, ctx.tenantId),
        eq(candidatesTable.userId, ctx.userId),
      ),
    });

    const fromEmail = candidate?.email || '';
    const fromName = candidate?.preferredName || candidate?.legalName || '';
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    const rawMessage = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sendResponse = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!sendResponse.ok) {
      throw new Error(`Failed to send email: ${await sendResponse.text()}`);
    }

    const sendResult = await sendResponse.json();

    // Save to sent_emails table
    await db.insert(sentEmails).values({
      id: createId(),
      tenantId: ctx.tenantId,
      candidateId: candidate?.id || '',
      applicationId: applicationId || null,
      to,
      subject,
      body,
      templateType: templateType || null,
    });

    res.json({ success: true, messageId: sendResult.id });
  } catch (e) {
    next(e);
  }
});

export default router;
