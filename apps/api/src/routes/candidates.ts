import { and, eq } from 'drizzle-orm';
import { Router } from 'express';

import { db } from '@job-pilot/db';
import { candidates } from '@job-pilot/db/schema';

import { cacheDelete, cacheGet, cacheSet } from '../lib/cache.js';
import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';

const router = Router();

// GET /api/candidates
router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const cacheKey = `candidate:${ctx.tenantId}:${ctx.userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });

    if (!candidate) throw new Error('No candidate profile found.');

    await cacheSet(cacheKey, candidate, 600);
    res.json(candidate);
  } catch (e) {
    next(e);
  }
});

// POST /api/candidates
router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const data = req.body;

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });

    if (!candidate) throw new Error('No candidate profile found.');

    const [updated] = await db
      .update(candidates)
      .set({
        email: data.email !== undefined ? data.email : candidate.email,
        phone: data.phone !== undefined ? data.phone : candidate.phone,
        legalName: data.legalName !== undefined ? data.legalName : candidate.legalName,
        preferredName:
          data.preferredName !== undefined ? data.preferredName : candidate.preferredName,
        headline: data.headline ?? candidate.headline,
        summary: data.summary ?? candidate.summary,
        currentTitle: data.currentTitle ?? candidate.currentTitle,
        currentCompany:
          data.currentCompany !== undefined ? data.currentCompany : candidate.currentCompany,
        location: data.location ?? candidate.location,
        remotePreference: data.remotePreference ?? candidate.remotePreference,
        yearsOfExperience: data.yearsOfExperience ?? candidate.yearsOfExperience,
        salaryMin: data.salaryMin !== undefined ? data.salaryMin : candidate.salaryMin,
        salaryMax: data.salaryMax !== undefined ? data.salaryMax : candidate.salaryMax,
        salaryCurrency: data.salaryCurrency ?? candidate.salaryCurrency,
        visaRequired: data.visaRequired ?? candidate.visaRequired,
        linkedinUrl: data.linkedinUrl !== undefined ? data.linkedinUrl : candidate.linkedinUrl,
        githubUrl: data.githubUrl !== undefined ? data.githubUrl : candidate.githubUrl,
        websiteUrl: data.websiteUrl !== undefined ? data.websiteUrl : candidate.websiteUrl,
        portfolioUrl: data.portfolioUrl !== undefined ? data.portfolioUrl : candidate.portfolioUrl,
        avoidedCompanies:
          data.avoidedCompanies !== undefined ? data.avoidedCompanies : candidate.avoidedCompanies,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidate.id))
      .returning();

    await cacheDelete(`candidate:${ctx.tenantId}:${ctx.userId}`);
    capture(ctx.userId, 'candidate_profile_updated', {
      candidateId: candidate.id,
      tenantId: ctx.tenantId,
    });
    res.json(updated);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'candidate_profile_updated', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

export default router;
