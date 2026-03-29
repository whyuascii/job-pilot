import { Router } from 'express';
import { getTenantContext } from '../lib/context.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { getClient, loadCandidateProfile, recordLLMRun, parseJsonResponse } from './ai.js';
import { db } from '@job-pilot/db';
import { candidates, jobs, projects } from '@job-pilot/db/schema';
import { eq, and } from 'drizzle-orm';
import type Anthropic from '@anthropic-ai/sdk';
import { PROFILE_COACH_PROMPT, PROFILE_ANALYSIS_PROMPT, CAREER_GROWTH_PROMPT } from '@job-pilot/mastra/prompts';

const MODEL = 'claude-sonnet-4-20250514';

// Prompt imported from @job-pilot/mastra/prompts (single source of truth)
const COACH_SYSTEM_PROMPT = PROFILE_COACH_PROMPT;

const router = Router();

router.post('/chat', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`profileCoach:${ctx.tenantId}`, 30);

    const { message, conversationHistory = [], activeSection } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Get candidate profile
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.status(400).json({ error: 'No candidate profile found. Create one before using AI Coach.' });
      return;
    }

    const profile = await loadCandidateProfile(candidate.id);

    // Load projects separately (not in loadCandidateProfile)
    const candidateProjects = await db.query.projects.findMany({
      where: eq(projects.candidateId, candidate.id),
    });

    // Build profile context for system prompt
    const profileContext = JSON.stringify({
      headline: profile.headline,
      summary: profile.summary,
      currentTitle: profile.currentTitle,
      currentCompany: profile.currentCompany,
      yearsOfExperience: profile.yearsOfExperience,
      location: profile.location,
      skills: profile.skills.map((s: any) => ({
        name: s.name,
        category: s.category,
        confidenceScore: s.confidenceScore,
        yearsUsed: s.yearsUsed,
      })),
      experience: profile.experience.map((e: any) => ({
        id: e.id,
        company: e.company,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        current: e.current,
        description: e.description,
        bullets: e.bullets,
        skills: e.skills,
      })),
      projects: candidateProjects.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        url: p.url,
        skills: p.skills,
        highlights: p.highlights,
      })),
    }, null, 2);

    const systemPrompt = `${COACH_SYSTEM_PROMPT}\n\n## CANDIDATE PROFILE\n${profileContext}${activeSection ? `\n\nThe user is currently viewing the "${activeSection}" section of their profile.` : ''}`;

    // Cap conversation history at last 10 message pairs (20 messages)
    const trimmedHistory = conversationHistory.slice(-20).map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...trimmedHistory,
      { role: 'user' as const, content: message.trim() },
    ];

    const client = await getClient();
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let success = false;
    let errorMsg: string | undefined;

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      });

      inputTokens = response.usage?.input_tokens ?? 0;
      outputTokens = response.usage?.output_tokens ?? 0;

      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const parsed = parseJsonResponse<{ message: string; suggestions?: any[] }>(responseText);
      success = true;

      res.json({
        message: parsed.message,
        suggestions: parsed.suggestions || [],
      });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      await recordLLMRun({
        tenantId: ctx.tenantId,
        candidateId: candidate.id,
        purpose: 'profile_coach',
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

router.post('/analyze', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`profileAnalyze:${ctx.tenantId}`, 10);

    // Get candidate profile
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.status(400).json({ error: 'No candidate profile found. Create one before using AI Coach.' });
      return;
    }

    const profile = await loadCandidateProfile(candidate.id);

    // Load projects separately (not in loadCandidateProfile)
    const candidateProjects = await db.query.projects.findMany({
      where: eq(projects.candidateId, candidate.id),
    });

    // Build profile context for system prompt
    const profileContext = JSON.stringify({
      headline: profile.headline,
      summary: profile.summary,
      currentTitle: profile.currentTitle,
      currentCompany: profile.currentCompany,
      yearsOfExperience: profile.yearsOfExperience,
      location: profile.location,
      skills: profile.skills.map((s: any) => ({
        name: s.name,
        category: s.category,
        confidenceScore: s.confidenceScore,
        yearsUsed: s.yearsUsed,
      })),
      experience: profile.experience.map((e: any) => ({
        id: e.id,
        company: e.company,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        current: e.current,
        description: e.description,
        bullets: e.bullets,
        skills: e.skills,
      })),
      projects: candidateProjects.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        url: p.url,
        skills: p.skills,
        highlights: p.highlights,
      })),
    }, null, 2);

    const systemPrompt = `${PROFILE_ANALYSIS_PROMPT}\n\n## CANDIDATE PROFILE\n${profileContext}`;

    const client = await getClient();
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let success = false;
    let errorMsg: string | undefined;

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Analyze my profile and give me actionable feedback.' }],
      });

      inputTokens = response.usage?.input_tokens ?? 0;
      outputTokens = response.usage?.output_tokens ?? 0;

      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const parsed = parseJsonResponse<{ message: string; suggestions?: any[]; profileScore?: number; priorities?: string[] }>(responseText);
      success = true;

      res.json({
        message: parsed.message,
        suggestions: parsed.suggestions || [],
        profileScore: parsed.profileScore,
        priorities: parsed.priorities || [],
      });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      await recordLLMRun({
        tenantId: ctx.tenantId,
        candidateId: candidate.id,
        purpose: 'profile_analysis',
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

router.post('/career-growth', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`careerGrowth:${ctx.tenantId}`, 10);

    const { jobId } = req.body;
    if (!jobId || typeof jobId !== 'string') {
      res.status(400).json({ error: 'jobId is required' });
      return;
    }

    // Load job data
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.tenantId, ctx.tenantId)),
    });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Get candidate profile
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.status(400).json({ error: 'No candidate profile found. Create one before using career growth advisor.' });
      return;
    }

    const profile = await loadCandidateProfile(candidate.id);

    // Load projects separately (not in loadCandidateProfile)
    const candidateProjects = await db.query.projects.findMany({
      where: eq(projects.candidateId, candidate.id),
    });

    // Build profile context
    const profileContext = JSON.stringify({
      headline: profile.headline,
      summary: profile.summary,
      currentTitle: profile.currentTitle,
      currentCompany: profile.currentCompany,
      yearsOfExperience: profile.yearsOfExperience,
      location: profile.location,
      skills: profile.skills.map((s: any) => ({
        name: s.name,
        category: s.category,
        confidenceScore: s.confidenceScore,
        yearsUsed: s.yearsUsed,
      })),
      experience: profile.experience.map((e: any) => ({
        id: e.id,
        company: e.company,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        current: e.current,
        description: e.description,
        bullets: e.bullets,
        skills: e.skills,
      })),
      projects: candidateProjects.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        url: p.url,
        skills: p.skills,
        highlights: p.highlights,
      })),
    }, null, 2);

    // Build job context
    const jobContext = JSON.stringify({
      title: job.title,
      company: job.company,
      location: job.location,
      remotePolicy: job.remotePolicy,
      description: job.parsedDescription || job.rawDescription,
      mustHaveSkills: job.mustHaveSkills,
      niceToHaveSkills: job.niceToHaveSkills,
      yearsRequired: job.yearsRequired,
      domain: job.domain,
      employmentType: job.employmentType,
      compensationMin: job.compensationMin,
      compensationMax: job.compensationMax,
    }, null, 2);

    const systemPrompt = `${CAREER_GROWTH_PROMPT}\n\n## CANDIDATE PROFILE\n${profileContext}\n\n## TARGET JOB\n${jobContext}`;

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
        messages: [{ role: 'user', content: 'Analyze the gap between my current profile and this target role, and provide a concrete growth plan.' }],
      });

      inputTokens = response.usage?.input_tokens ?? 0;
      outputTokens = response.usage?.output_tokens ?? 0;

      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const parsed = parseJsonResponse<{
        summary: string;
        readinessScore: number;
        skillGaps: any[];
        certifications: any[];
        projectIdeas: any[];
        employerActions: any[];
        timelineMonths: number;
        encouragement: string;
      }>(responseText);
      success = true;

      res.json(parsed);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      await recordLLMRun({
        tenantId: ctx.tenantId,
        candidateId: candidate.id,
        jobId,
        purpose: 'career_growth',
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
