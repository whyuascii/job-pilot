import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, jobs, tailoredResumes } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';

const router = Router();

function formatResumeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Present';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  } catch {
    return dateStr;
  }
}

function generateResumeHtml(content: any, candidate: any, job: any): string {
  const experienceHtml = (content.experienceBlocks || [])
    .map(
      (exp: any) => `
    <div class="experience-block">
      <div class="exp-header">
        <strong>${exp.title}</strong> at ${exp.company}
        <span class="dates">${formatResumeDate(exp.startDate)} – ${formatResumeDate(exp.endDate)}</span>
      </div>
      <ul>${(exp.bullets || []).map((b: string) => `<li>${b}</li>`).join('')}</ul>
    </div>`,
    )
    .join('');

  const projectsHtml = (content.projectHighlights || [])
    .map(
      (p: any) => `
    <div class="project-block">
      <strong>${p.name}</strong>
      <p>${p.description}</p>
      ${p.skills?.length ? `<div class="skills">${p.skills.join(' · ')}</div>` : ''}
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${candidate.currentTitle || 'Resume'} – ${job.company}</title>
<style>
  body { font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6; }
  h1 { font-size: 24px; margin-bottom: 4px; } h2 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 4px; margin-top: 24px; }
  .contact { color: #666; font-size: 14px; } .skills-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .skill-tag { background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
  .experience-block { margin-bottom: 16px; } .exp-header { display: flex; justify-content: space-between; } .dates { color: #666; font-size: 14px; }
  ul { margin: 4px 0; padding-left: 20px; } li { margin-bottom: 4px; font-size: 14px; }
  .project-block { margin-bottom: 12px; } .project-block p { margin: 4px 0; font-size: 14px; }
  @media print { body { padding: 20px; } }
</style></head>
<body>
  ${candidate.legalName ? `<h1>${candidate.legalName}</h1>` : `<h1>${candidate.headline || candidate.currentTitle || 'Professional Resume'}</h1>`}
  <div class="contact">${[candidate.currentTitle, candidate.location].filter(Boolean).join(' | ')}</div>
  <h2>Summary</h2><p>${content.summary || candidate.summary || ''}</p>
  ${content.highlightedSkills?.length ? `<h2>Key Skills</h2><div class="skills-list">${content.highlightedSkills.map((s: string) => `<span class="skill-tag">${s}</span>`).join('')}</div>` : ''}
  ${experienceHtml ? `<h2>Experience</h2>${experienceHtml}` : ''}
  ${projectsHtml ? `<h2>Projects</h2>${projectsHtml}` : ''}
</body></html>`;
}

router.post('/export', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId } = req.body;
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found.');
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.tenantId, ctx.tenantId)),
    });
    if (!job) throw new Error('Job not found');
    const tailored = await db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    });
    if (!tailored) throw new Error('No tailored resume found. Generate one first.');
    const content = tailored.contentJson as any;
    const html = generateResumeHtml(content, candidate, job);
    res.json({ html, fileName: `${candidate.currentTitle || 'resume'}-${job.company}.html` });
  } catch (e) {
    next(e);
  }
});

export default router;
