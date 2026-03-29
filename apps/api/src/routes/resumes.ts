import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, resumes } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';
import { deleteObject, getDownloadUrl, getUploadUrl } from '../lib/s3.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const router = Router();

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate) throw new Error('No candidate profile found.');
  return candidate;
}

router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const list = await db.query.resumes.findMany({
      where: eq(resumes.candidateId, candidate.id),
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post('/upload-url', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { fileName, contentType } = req.body;
    const storageKey = `resumes/${ctx.tenantId}/${candidate.id}/${createId()}_${fileName}`;
    const uploadUrl = await getUploadUrl(storageKey, contentType || 'application/pdf');
    res.json({ uploadUrl, storageKey });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { fileName, storageKey } = req.body;
    const resumeName = fileName || storageKey?.split('/').pop() || 'Untitled Resume';
    const [resume] = await db
      .insert(resumes)
      .values({
        id: createId(),
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        name: resumeName,
        storageKey,
        isPreferred: false,
      })
      .returning();
    capture(ctx.userId, 'resume_created', { resumeId: resume.id, tenantId: ctx.tenantId });
    res.json(resume);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'resume_created', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

router.post('/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { resumeId } = req.body;
    const resume = await db.query.resumes.findFirst({
      where: and(eq(resumes.id, resumeId), eq(resumes.candidateId, candidate.id)),
    });
    if (!resume) throw new Error('Resume not found');
    await deleteObject(resume.storageKey);
    await db.delete(resumes).where(eq(resumes.id, resumeId));
    capture(ctx.userId, 'resume_deleted', { resumeId, tenantId: ctx.tenantId });
    res.json({ success: true });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'resume_deleted', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

router.post('/set-preferred', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { resumeId } = req.body;
    await db
      .update(resumes)
      .set({ isPreferred: false })
      .where(eq(resumes.candidateId, candidate.id));
    const [updated] = await db
      .update(resumes)
      .set({ isPreferred: true })
      .where(and(eq(resumes.id, resumeId), eq(resumes.candidateId, candidate.id)))
      .returning();
    if (!updated) throw new Error('Resume not found');
    capture(ctx.userId, 'resume_set_preferred', { resumeId, tenantId: ctx.tenantId });
    res.json(updated);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'resume_set_preferred', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

router.get('/download-url', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const resumeId = (req.query.id || req.query.resumeId) as string;
    const resume = await db.query.resumes.findFirst({
      where: and(eq(resumes.id, resumeId), eq(resumes.candidateId, candidate.id)),
    });
    if (!resume) throw new Error('Resume not found');
    const url = await getDownloadUrl(resume.storageKey);
    res.json({ url });
  } catch (e) {
    next(e);
  }
});

export default router;
