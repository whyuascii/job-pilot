import type Anthropic from '@anthropic-ai/sdk';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, careerGoals, jobs, preferences, projects } from '@job-pilot/db/schema';
import { CAREER_GROWTH_PROMPT } from '@job-pilot/mastra/prompts';
import { getTenantContext } from '../lib/context.js';
import { capture } from '../lib/posthog.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { getClient, loadCandidateProfile, parseJsonResponse, recordLLMRun } from './ai.js';

const MODEL = 'claude-sonnet-4-20250514';

const router = Router();

// GET /api/career-goals — list career goals with job data
router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const goals = await db.query.careerGoals.findMany({
      where: eq(careerGoals.tenantId, ctx.tenantId),
      orderBy: [desc(careerGoals.createdAt)],
    });

    // Fetch associated job data for each goal
    const enriched = await Promise.all(
      goals.map(async (goal) => {
        const job = await db.query.jobs.findFirst({ where: eq(jobs.id, goal.jobId) });
        return { ...goal, job: job ?? null };
      }),
    );

    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// POST /api/career-goals — save a job as career goal
router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId, notes } = req.body;

    if (!jobId) {
      res.status(400).json({ error: 'jobId is required' });
      return;
    }

    // Get candidate
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.status(400).json({ error: 'No candidate profile found.' });
      return;
    }

    // Check if already saved
    const existing = await db.query.careerGoals.findFirst({
      where: and(
        eq(careerGoals.jobId, jobId),
        eq(careerGoals.candidateId, candidate.id),
        eq(careerGoals.tenantId, ctx.tenantId),
      ),
    });
    if (existing) {
      res.json(existing);
      return;
    }

    const [goal] = await db
      .insert(careerGoals)
      .values({
        jobId,
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        notes: notes || null,
      })
      .returning();

    capture(ctx.userId, 'career_goal_set', { tenantId: ctx.tenantId });
    res.json(goal);
  } catch (e) {
    next(e);
  }
});

// POST /api/career-goals/toggle-selected — toggle selectedForCoaching
router.post('/toggle-selected', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { goalId, selected } = req.body;

    if (!goalId || typeof selected !== 'boolean') {
      res.status(400).json({ error: 'goalId and selected (boolean) are required' });
      return;
    }

    // If selecting, enforce max 10 selected
    if (selected) {
      const selectedCount = await db.query.careerGoals.findMany({
        where: and(
          eq(careerGoals.tenantId, ctx.tenantId),
          eq(careerGoals.selectedForCoaching, true),
        ),
        columns: { id: true },
      });
      if (selectedCount.length >= 10) {
        res
          .status(400)
          .json({ error: 'Maximum of 10 roles can be selected for coaching. Deselect one first.' });
        return;
      }
    }

    const [updated] = await db
      .update(careerGoals)
      .set({ selectedForCoaching: selected, updatedAt: new Date() })
      .where(and(eq(careerGoals.id, goalId), eq(careerGoals.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Career goal not found' });
      return;
    }

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /api/career-goals/delete — delete career goal
router.post('/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { goalId } = req.body;

    if (!goalId) {
      res.status(400).json({ error: 'goalId is required' });
      return;
    }

    await db
      .delete(careerGoals)
      .where(and(eq(careerGoals.id, goalId), eq(careerGoals.tenantId, ctx.tenantId)));

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// GET /api/career-goals/coaching-plan — get stored coaching plan
router.get('/coaching-plan', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.json(null);
      return;
    }

    const pref = await db.query.preferences.findFirst({
      where: and(
        eq(preferences.candidateId, candidate.id),
        eq(preferences.key, 'careerCoachingPlan'),
      ),
    });

    res.json(pref ? JSON.parse(pref.value) : null);
  } catch (e) {
    next(e);
  }
});

// POST /api/career-goals/generate-coaching-plan — generate coaching plan from selected goals
router.post('/generate-coaching-plan', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`careerCoaching:${ctx.tenantId}`, 5);

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.status(400).json({ error: 'No candidate profile found.' });
      return;
    }

    // Load only selected career goals
    const goals = await db.query.careerGoals.findMany({
      where: and(eq(careerGoals.tenantId, ctx.tenantId), eq(careerGoals.selectedForCoaching, true)),
    });

    if (goals.length === 0) {
      res
        .status(400)
        .json({ error: 'No goals selected for coaching. Toggle some goals on first.' });
      return;
    }

    const goalJobs = await Promise.all(
      goals.map(async (goal) => {
        const job = await db.query.jobs.findFirst({ where: eq(jobs.id, goal.jobId) });
        return job;
      }),
    );
    const validJobs = goalJobs.filter(Boolean);

    if (validJobs.length === 0) {
      res.status(400).json({ error: 'No valid jobs found for your career goals.' });
      return;
    }

    const profile = await loadCandidateProfile(candidate.id);
    const candidateProjects = await db.query.projects.findMany({
      where: eq(projects.candidateId, candidate.id),
    });

    const profileContext = JSON.stringify(
      {
        headline: profile.headline,
        summary: profile.summary,
        currentTitle: profile.currentTitle,
        currentCompany: profile.currentCompany,
        yearsOfExperience: profile.yearsOfExperience,
        location: profile.location,
        skills:
          profile.skills?.map((s: any) => ({
            name: s.name,
            category: s.category,
            confidenceScore: s.confidenceScore,
          })) || [],
        experience:
          profile.experience?.map((e: any) => ({
            company: e.company,
            title: e.title,
            startDate: e.startDate,
            endDate: e.endDate,
            bullets: e.bullets,
            skills: e.skills,
          })) || [],
        projects: candidateProjects.map((p: any) => ({
          name: p.name,
          description: p.description,
          skills: p.skills,
          highlights: p.highlights,
        })),
      },
      null,
      2,
    );

    const jobsContext = JSON.stringify(
      validJobs.map((job: any) => ({
        title: job.title,
        company: job.company,
        location: job.location,
        remotePolicy: job.remotePolicy,
        description: (job.parsedDescription || job.rawDescription || '').slice(0, 2000),
        mustHaveSkills: job.mustHaveSkills,
        niceToHaveSkills: job.niceToHaveSkills,
        yearsRequired: job.yearsRequired,
        domain: job.domain,
        employmentType: job.employmentType,
        compensationMin: job.compensationMin,
        compensationMax: job.compensationMax,
      })),
      null,
      2,
    );

    const systemPrompt = `${CAREER_GROWTH_PROMPT}\n\n## CANDIDATE PROFILE\n${profileContext}\n\n## TARGET ROLES (${validJobs.length} saved aspirational jobs)\n${jobsContext}`;

    const client = await getClient();
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let success = false;
    let errorMsg: string | undefined;

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `I have ${validJobs.length} aspirational roles saved. Analyze the overall pattern and give me a unified career coaching plan.`,
          },
        ],
      });

      inputTokens = response.usage?.input_tokens ?? 0;
      outputTokens = response.usage?.output_tokens ?? 0;

      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const parsed = parseJsonResponse<any>(responseText);
      parsed.generatedAt = new Date().toISOString();
      parsed.jobCount = validJobs.length;
      success = true;

      // Store in preferences
      const existingPref = await db.query.preferences.findFirst({
        where: and(
          eq(preferences.candidateId, candidate.id),
          eq(preferences.key, 'careerCoachingPlan'),
        ),
      });

      if (existingPref) {
        await db
          .update(preferences)
          .set({ value: JSON.stringify(parsed) })
          .where(eq(preferences.id, existingPref.id));
      } else {
        await db.insert(preferences).values({
          candidateId: candidate.id,
          key: 'careerCoachingPlan',
          value: JSON.stringify(parsed),
          category: 'career',
        });
      }

      res.json(parsed);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      await recordLLMRun({
        tenantId: ctx.tenantId,
        candidateId: candidate.id,
        purpose: 'career_coaching',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startTime,
        success,
        error: errorMsg,
      });
    }
  } catch (e) {
    next(e);
  }
});

export default router;
