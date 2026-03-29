import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, coverLetters, jobs, jobScores } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const RXRESUME_URL = process.env.RXRESUME_URL || 'http://localhost:3100';

function getS3Client() {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: process.env.S3_REGION || 'us-east-1',
  };
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = true;
    if (process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY) {
      config.credentials = {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      };
    }
  }
  return new S3Client(config);
}

const RXRESUME_TEMPLATES = [
  { id: 'azurill', name: 'Azurill' },
  { id: 'bronzor', name: 'Bronzor' },
  { id: 'chikorita', name: 'Chikorita' },
  { id: 'ditto', name: 'Ditto' },
  { id: 'gengar', name: 'Gengar' },
  { id: 'glalie', name: 'Glalie' },
  { id: 'kakuna', name: 'Kakuna' },
  { id: 'leafish', name: 'Leafish' },
  { id: 'nosepass', name: 'Nosepass' },
  { id: 'onyx', name: 'Onyx' },
  { id: 'pikachu', name: 'Pikachu' },
  { id: 'rhyhorn', name: 'Rhyhorn' },
];

interface TailoredContent {
  summary?: string;
  highlightedSkills?: string[];
  experienceBlocks?: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string | null;
    bullets: string[];
  }>;
  projectHighlights?: Array<{
    name: string;
    description: string;
    skills: string[];
    highlights: string[];
  }>;
}

function mapToRxResumeSchema(content: TailoredContent, candidate: any) {
  return {
    basics: {
      name: candidate.preferredName || candidate.legalName || '',
      headline: candidate.headline || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      location: candidate.location || '',
      url: { label: '', href: candidate.websiteUrl || '' },
      customFields: [],
    },
    sections: {
      summary: {
        name: 'Summary',
        columns: 1,
        visible: true,
        id: 'summary',
        content: content.summary || '',
      },
      experience: {
        name: 'Experience',
        columns: 1,
        visible: true,
        id: 'experience',
        items: (content.experienceBlocks || []).map((block) => ({
          id: createId(),
          visible: true,
          company: block.company,
          position: block.title,
          startDate: block.startDate,
          endDate: block.endDate || '',
          summary: (block.bullets || []).map((b) => `- ${b}`).join('\n'),
        })),
      },
      skills: {
        name: 'Skills',
        columns: 1,
        visible: true,
        id: 'skills',
        items: (content.highlightedSkills || []).map((skill) => ({
          id: createId(),
          visible: true,
          name: skill,
          description: '',
          level: 0,
          keywords: [],
        })),
      },
      projects: {
        name: 'Projects',
        columns: 1,
        visible: (content.projectHighlights || []).length > 0,
        id: 'projects',
        items: (content.projectHighlights || []).map((project) => ({
          id: createId(),
          visible: true,
          name: project.name,
          description: project.description,
          summary: (project.highlights || []).join('. '),
          keywords: project.skills || [],
          url: { label: '', href: '' },
        })),
      },
    },
    metadata: {
      template: 'azurill',
      layout: [[['summary', 'experience', 'projects'], ['skills']]],
      css: { value: '', visible: false },
      page: { margin: 18, format: 'a4', options: { breakLine: true, pageNumbers: true } },
      theme: { background: '#ffffff', text: '#000000', primary: '#0ea5e9' },
      typography: {
        font: { family: 'IBM Plex Sans', subset: 'latin', variants: ['regular'] },
        fontSize: 14,
        lineHeight: 1.5,
        hideIcons: false,
        underlineLinks: true,
      },
    },
  };
}

const router = Router();

// GET /api/rxresume/templates
router.get('/templates', async (_req, res) => {
  res.json(RXRESUME_TEMPLATES);
});

// POST /api/rxresume/generate-pdf
router.post('/generate-pdf', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId, templateId } = req.body;
    if (!jobId) throw new Error('jobId is required');

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found');

    // Get tailored resume content
    let tailoredContent: TailoredContent = {};
    try {
      const { tailoredResumes } = await import('@job-pilot/db/schema');
      const tailored = await db.query.tailoredResumes?.findFirst({
        where: and(eq(tailoredResumes.jobId, jobId), eq(tailoredResumes.candidateId, candidate.id)),
      });
      if (tailored) tailoredContent = tailored.contentJson as TailoredContent;
    } catch {}

    // Map to RxResume schema
    const resumeData = mapToRxResumeSchema(tailoredContent, candidate);
    if (templateId) {
      resumeData.metadata.template = templateId;
    }

    // Create resume in RxResume
    const createResponse = await fetch(`${RXRESUME_URL}/api/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${candidate.preferredName || candidate.legalName || 'Resume'} - ${jobId}`,
        visibility: 'private',
        data: resumeData,
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`RxResume create failed: ${await createResponse.text()}`);
    }

    const created = await createResponse.json();

    // Export as PDF
    const pdfResponse = await fetch(`${RXRESUME_URL}/api/resume/print/${created.id}`, {
      method: 'GET',
    });

    if (!pdfResponse.ok) {
      throw new Error(`RxResume PDF export failed: ${await pdfResponse.text()}`);
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Count existing versions for this job
    const s3Client = getS3Client();
    const bucket = process.env.S3_BUCKET || 'job-pilot';
    const key = `resumes/${ctx.tenantId}/${jobId}/tailored-v${Date.now()}.pdf`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }),
    );

    // Generate download URL
    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: 3600 },
    );

    // Clean up temp resume in RxResume
    try {
      await fetch(`${RXRESUME_URL}/api/resume/${created.id}`, { method: 'DELETE' });
    } catch {}

    capture(ctx.userId, 'resume_pdf_generated', {
      jobId,
      templateId: resumeData.metadata.template,
      tenantId: ctx.tenantId,
    });
    res.json({ url: downloadUrl, key });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'resume_pdf_generated', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

export default router;
