import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@job-pilot/db';
import { candidates, jobs, tailoredResumes, users } from '@job-pilot/db/schema';
import { getTenantContext } from '~/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TailoredResumeContent {
  summary: string;
  highlightedSkills: string[];
  experienceBlocks: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string | null;
    bullets: string[];
    relevanceScore: number;
  }>;
  projectHighlights: Array<{
    name: string;
    description: string;
    skills: string[];
    highlights: string[];
  }>;
  gapAnalysis: {
    missingSkills: string[];
    recommendations: string[];
  };
  overallConfidence: 'high' | 'medium' | 'low';
}

interface CandidateInfo {
  name: string;
  email: string;
  currentTitle: string;
  location: string;
  headline: string;
}

// ---------------------------------------------------------------------------
// HTML Generation
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateRange(startDate: string, endDate: string | null): string {
  const fmt = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };
  const start = fmt(startDate);
  const end = endDate ? fmt(endDate) : 'Present';
  return `${start} - ${end}`;
}

/**
 * Generate a clean, ATS-friendly HTML resume from tailored content and
 * candidate basic info. The output is a complete HTML document ready to
 * be opened in a browser and printed to PDF via the browser print dialog.
 */
export function generateResumeHtml(
  content: TailoredResumeContent,
  candidate: CandidateInfo,
  jobTitle: string,
  company: string,
): string {
  // Sort experience blocks by relevance score descending
  const sortedExperience = [...content.experienceBlocks].sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );

  const skillsHtml = content.highlightedSkills
    .map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`)
    .join('\n            ');

  const experienceHtml = sortedExperience
    .map(
      (block) => `
          <div class="experience-block">
            <div class="experience-header">
              <div>
                <h3 class="experience-title">${escapeHtml(block.title)}</h3>
                <p class="experience-company">${escapeHtml(block.company)}</p>
              </div>
              <span class="experience-dates">${escapeHtml(formatDateRange(block.startDate, block.endDate))}</span>
            </div>
            ${
              block.bullets.length > 0
                ? `<ul class="experience-bullets">
              ${block.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('\n              ')}
            </ul>`
                : ''
            }
          </div>`,
    )
    .join('\n');

  const projectsHtml =
    content.projectHighlights.length > 0
      ? content.projectHighlights
          .map(
            (proj) => `
          <div class="project-block">
            <h3 class="project-name">${escapeHtml(proj.name)}</h3>
            <p class="project-description">${escapeHtml(proj.description)}</p>
            ${
              proj.skills.length > 0
                ? `<div class="project-skills">
              ${proj.skills.map((s) => `<span class="skill-tag skill-tag-sm">${escapeHtml(s)}</span>`).join('\n              ')}
            </div>`
                : ''
            }
            ${
              proj.highlights.length > 0
                ? `<ul class="project-highlights">
              ${proj.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('\n              ')}
            </ul>`
                : ''
            }
          </div>`,
          )
          .join('\n')
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(candidate.name)} - Resume for ${escapeHtml(jobTitle)} at ${escapeHtml(company)}</title>
  <style>
    /* Reset & Base */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      background: #fff;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in 0.6in;
    }

    /* Print-specific rules */
    @media print {
      body {
        padding: 0;
        max-width: none;
      }

      .no-print {
        display: none !important;
      }

      @page {
        margin: 0.5in 0.6in;
        size: letter;
      }

      a {
        text-decoration: none;
        color: #1a1a1a;
      }
    }

    /* Screen-only toolbar */
    @media screen {
      .print-toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #f8f9fa;
        border-bottom: 1px solid #dee2e6;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 1000;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      .print-toolbar-info {
        font-size: 13px;
        color: #6b7280;
      }

      .print-btn {
        background: #2563eb;
        color: #fff;
        border: none;
        padding: 8px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
      }

      .print-btn:hover {
        background: #1d4ed8;
      }

      body {
        margin-top: 64px;
        padding-top: 0.5in;
      }
    }

    /* Header / Contact */
    .resume-header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid #2563eb;
    }

    .candidate-name {
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: #111827;
      margin-bottom: 4px;
    }

    .candidate-title {
      font-size: 12pt;
      color: #4b5563;
      font-weight: 400;
      margin-bottom: 8px;
    }

    .contact-row {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      font-size: 10pt;
      color: #6b7280;
    }

    .contact-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Sections */
    .section {
      margin-bottom: 18px;
    }

    .section-title {
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #2563eb;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }

    /* Summary */
    .summary-text {
      font-size: 10.5pt;
      line-height: 1.6;
      color: #374151;
    }

    /* Skills */
    .skills-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .skill-tag {
      display: inline-block;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      padding: 2px 10px;
      border-radius: 3px;
      font-size: 9.5pt;
      font-weight: 500;
    }

    .skill-tag-sm {
      font-size: 8.5pt;
      padding: 1px 7px;
    }

    /* Experience */
    .experience-block {
      margin-bottom: 14px;
    }

    .experience-block:last-child {
      margin-bottom: 0;
    }

    .experience-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 4px;
    }

    .experience-title {
      font-size: 11pt;
      font-weight: 600;
      color: #111827;
    }

    .experience-company {
      font-size: 10pt;
      color: #4b5563;
      font-weight: 500;
    }

    .experience-dates {
      font-size: 9.5pt;
      color: #6b7280;
      white-space: nowrap;
      flex-shrink: 0;
      padding-top: 2px;
    }

    .experience-bullets {
      list-style: disc;
      padding-left: 18px;
      margin-top: 4px;
    }

    .experience-bullets li {
      font-size: 10pt;
      line-height: 1.5;
      color: #374151;
      margin-bottom: 2px;
    }

    /* Projects */
    .project-block {
      margin-bottom: 12px;
    }

    .project-block:last-child {
      margin-bottom: 0;
    }

    .project-name {
      font-size: 10.5pt;
      font-weight: 600;
      color: #111827;
      margin-bottom: 2px;
    }

    .project-description {
      font-size: 10pt;
      color: #4b5563;
      margin-bottom: 4px;
    }

    .project-skills {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 4px;
    }

    .project-highlights {
      list-style: disc;
      padding-left: 18px;
    }

    .project-highlights li {
      font-size: 9.5pt;
      line-height: 1.5;
      color: #374151;
      margin-bottom: 1px;
    }
  </style>
</head>
<body>
  <!-- Print toolbar (hidden when printing) -->
  <div class="print-toolbar no-print">
    <span class="print-toolbar-info">
      Resume tailored for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong>
    </span>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <!-- Resume Content -->
  <header class="resume-header">
    <h1 class="candidate-name">${escapeHtml(candidate.name)}</h1>
    <p class="candidate-title">${escapeHtml(candidate.headline || candidate.currentTitle)}</p>
    <div class="contact-row">
      ${candidate.email ? `<span class="contact-item">${escapeHtml(candidate.email)}</span>` : ''}
      ${candidate.location ? `<span class="contact-item">${escapeHtml(candidate.location)}</span>` : ''}
    </div>
  </header>

  <!-- Summary -->
  <section class="section">
    <h2 class="section-title">Professional Summary</h2>
    <p class="summary-text">${escapeHtml(content.summary)}</p>
  </section>

  <!-- Skills -->
  ${
    content.highlightedSkills.length > 0
      ? `<section class="section">
    <h2 class="section-title">Technical Skills</h2>
    <div class="skills-container">
      ${skillsHtml}
    </div>
  </section>`
      : ''
  }

  <!-- Experience -->
  ${
    sortedExperience.length > 0
      ? `<section class="section">
    <h2 class="section-title">Professional Experience</h2>
    ${experienceHtml}
  </section>`
      : ''
  }

  <!-- Projects -->
  ${
    content.projectHighlights.length > 0
      ? `<section class="section">
    <h2 class="section-title">Projects</h2>
    ${projectsHtml}
  </section>`
      : ''
  }
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Server Function
// ---------------------------------------------------------------------------

/**
 * Export a tailored resume as a printable HTML document. Loads the tailored
 * resume content from the DB, fetches the candidate's basic info (name,
 * email, location), and generates a complete HTML page optimised for
 * browser print-to-PDF.
 */
export const exportTailoredResume = createServerFn({ method: 'POST' })
  .validator((data: { jobId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    // 1. Load the candidate
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });

    if (!candidate) {
      throw new Error('No candidate profile found. Create one before exporting a resume.');
    }

    // 2. Load the user record for name + email
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    // 3. Load the job
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, data.jobId), eq(jobs.tenantId, ctx.tenantId)),
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // 4. Load the latest tailored resume for this job + candidate
    const tailored = await db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, data.jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    });

    if (!tailored) {
      throw new Error('No tailored resume found for this job. Generate one first.');
    }

    const content = tailored.contentJson as TailoredResumeContent;

    // 5. Build candidate info — prefer legalName for resumes, fall back to user.name
    const displayName = candidate.legalName || user.name;
    const candidateInfo: CandidateInfo = {
      name: displayName,
      email: user.email,
      currentTitle: candidate.currentTitle,
      location: candidate.location,
      headline: candidate.headline,
    };

    // 6. Generate HTML
    const html = generateResumeHtml(content, candidateInfo, job.title, job.company);

    // 7. Build a clean filename
    const safeName = displayName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filename = `resume_${safeName}_${safeCompany}.html`;

    return { html, filename };
  });
