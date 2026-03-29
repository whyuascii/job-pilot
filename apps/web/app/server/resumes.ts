import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { candidates, resumes } from '@job-pilot/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getTenantContext } from '~/lib/api';
import { getUploadUrl, getDownloadUrl, deleteObject } from '~/lib/s3';

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (enforced client-side)

/**
 * Generate a presigned URL for uploading a resume file to S3.
 */
export const getUploadPresignedUrl = createServerFn({ method: 'POST' })
  .validator((data: { fileName: string; contentType: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(data.contentType as any)) {
      throw new Error(
        `Invalid file type. Allowed types: PDF, DOCX, TXT. Received: ${data.contentType}`
      );
    }

    // Validate file name
    if (!data.fileName || data.fileName.trim().length === 0) {
      throw new Error('File name is required');
    }

    // Get the candidate for this user
    const candidate = await db.query.candidates.findFirst({
      where: and(
        eq(candidates.tenantId, ctx.tenantId),
        eq(candidates.userId, ctx.userId),
      ),
    });

    if (!candidate) {
      throw new Error('No candidate profile found. Please create your profile first.');
    }

    // Generate unique storage key
    const timestamp = Date.now();
    const sanitizedFileName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `resumes/${ctx.tenantId}/${candidate.id}/${timestamp}-${sanitizedFileName}`;

    const uploadUrl = await getUploadUrl(storageKey, data.contentType);

    return { uploadUrl, storageKey };
  });

/**
 * Create a resume record in the database after the file has been uploaded to S3.
 */
export const createResume = createServerFn({ method: 'POST' })
  .validator((data: { name: string; storageKey: string; contentType: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    // Get the candidate for this user
    const candidate = await db.query.candidates.findFirst({
      where: and(
        eq(candidates.tenantId, ctx.tenantId),
        eq(candidates.userId, ctx.userId),
      ),
    });

    if (!candidate) {
      throw new Error('No candidate profile found. Please create your profile first.');
    }

    // Determine the file type from content type
    let type = 'uploaded';
    if (data.contentType === 'application/pdf') {
      type = 'pdf';
    } else if (
      data.contentType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      type = 'docx';
    } else if (data.contentType === 'text/plain') {
      type = 'txt';
    }

    // Check if this is the first resume (to set as preferred)
    const existingResumes = await db.query.resumes.findMany({
      where: and(
        eq(resumes.candidateId, candidate.id),
        eq(resumes.tenantId, ctx.tenantId),
      ),
    });

    const isFirst = existingResumes.length === 0;

    const [resume] = await db
      .insert(resumes)
      .values({
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        name: data.name,
        type,
        storageKey: data.storageKey,
        isPreferred: isFirst,
      })
      .returning();

    return resume;
  });

/**
 * List all resumes for the current candidate, ordered by most recent first.
 */
export const listResumes = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  const candidate = await db.query.candidates.findFirst({
    where: and(
      eq(candidates.tenantId, ctx.tenantId),
      eq(candidates.userId, ctx.userId),
    ),
  });

  if (!candidate) {
    return [];
  }

  const resumeList = await db.query.resumes.findMany({
    where: and(
      eq(resumes.candidateId, candidate.id),
      eq(resumes.tenantId, ctx.tenantId),
    ),
    orderBy: [desc(resumes.createdAt)],
  });

  return resumeList;
});

/**
 * Delete a resume from both S3 and the database.
 * If the deleted resume was preferred and others exist, set the most recent as preferred.
 */
export const deleteResume = createServerFn({ method: 'POST' })
  .validator((data: { resumeId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    const candidate = await db.query.candidates.findFirst({
      where: and(
        eq(candidates.tenantId, ctx.tenantId),
        eq(candidates.userId, ctx.userId),
      ),
    });

    if (!candidate) {
      throw new Error('No candidate profile found.');
    }

    // Find the resume to delete
    const resume = await db.query.resumes.findFirst({
      where: and(
        eq(resumes.id, data.resumeId),
        eq(resumes.candidateId, candidate.id),
        eq(resumes.tenantId, ctx.tenantId),
      ),
    });

    if (!resume) {
      throw new Error('Resume not found');
    }

    // Delete from S3
    await deleteObject(resume.storageKey);

    // Delete from database
    await db
      .delete(resumes)
      .where(
        and(
          eq(resumes.id, data.resumeId),
          eq(resumes.tenantId, ctx.tenantId),
        )
      );

    // If the deleted resume was preferred, set the most recent remaining as preferred
    if (resume.isPreferred) {
      const remaining = await db.query.resumes.findMany({
        where: and(
          eq(resumes.candidateId, candidate.id),
          eq(resumes.tenantId, ctx.tenantId),
        ),
        orderBy: [desc(resumes.createdAt)],
        limit: 1,
      });

      if (remaining.length > 0) {
        await db
          .update(resumes)
          .set({ isPreferred: true, updatedAt: new Date() })
          .where(eq(resumes.id, remaining[0].id));
      }
    }

    return { success: true };
  });

/**
 * Set a resume as the preferred resume, unsetting all others.
 */
export const setPreferredResume = createServerFn({ method: 'POST' })
  .validator((data: { resumeId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    const candidate = await db.query.candidates.findFirst({
      where: and(
        eq(candidates.tenantId, ctx.tenantId),
        eq(candidates.userId, ctx.userId),
      ),
    });

    if (!candidate) {
      throw new Error('No candidate profile found.');
    }

    // Verify the resume exists and belongs to this candidate
    const resume = await db.query.resumes.findFirst({
      where: and(
        eq(resumes.id, data.resumeId),
        eq(resumes.candidateId, candidate.id),
        eq(resumes.tenantId, ctx.tenantId),
      ),
    });

    if (!resume) {
      throw new Error('Resume not found');
    }

    // Unset all resumes' isPreferred for this candidate
    await db
      .update(resumes)
      .set({ isPreferred: false, updatedAt: new Date() })
      .where(
        and(
          eq(resumes.candidateId, candidate.id),
          eq(resumes.tenantId, ctx.tenantId),
        )
      );

    // Set the selected resume as preferred
    const [updated] = await db
      .update(resumes)
      .set({ isPreferred: true, updatedAt: new Date() })
      .where(eq(resumes.id, data.resumeId))
      .returning();

    return updated;
  });

/**
 * Get a presigned download URL for a resume.
 */
export const getResumeDownloadUrl = createServerFn({ method: 'GET' })
  .validator((data: { resumeId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    const candidate = await db.query.candidates.findFirst({
      where: and(
        eq(candidates.tenantId, ctx.tenantId),
        eq(candidates.userId, ctx.userId),
      ),
    });

    if (!candidate) {
      throw new Error('No candidate profile found.');
    }

    const resume = await db.query.resumes.findFirst({
      where: and(
        eq(resumes.id, data.resumeId),
        eq(resumes.candidateId, candidate.id),
        eq(resumes.tenantId, ctx.tenantId),
      ),
    });

    if (!resume) {
      throw new Error('Resume not found');
    }

    const downloadUrl = await getDownloadUrl(resume.storageKey);

    return { downloadUrl, resume };
  });
