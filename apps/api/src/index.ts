import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { auth } from './lib/auth.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { securityHeaders } from './middleware/security.js';
import { tenantMiddleware } from './middleware/tenant.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3001', 10);
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Trust proxy headers from ALB / CloudFront / reverse proxies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(securityHeaders);
app.use(
  cors({
    origin: APP_URL,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Health check (public, no auth required)
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Helper: build a Web Request from Express req using the public-facing origin.
// Behind a reverse proxy (Vite dev proxy, ALB, CloudFront, etc.) the Express
// Host header is the internal address (e.g. localhost:3001). better-auth's
// CSRF check compares the request URL origin against the browser Origin header,
// so we must use the public origin the browser actually sees.
// ---------------------------------------------------------------------------
function getPublicOrigin(req: express.Request): string {
  // Trust X-Forwarded-* headers from ALB / CloudFront / reverse proxies
  const fwdProto = req.get('x-forwarded-proto');
  const fwdHost = req.get('x-forwarded-host');
  if (fwdProto && fwdHost) {
    return `${fwdProto}://${fwdHost}`;
  }
  // Fall back to APP_URL (covers local dev proxy and simple deployments)
  return APP_URL;
}

function toWebHeaders(req: express.Request): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Better Auth handler — mounted BEFORE auth middleware
// All /api/auth/* requests are forwarded to better-auth's Web handler.
// ---------------------------------------------------------------------------
app.all('/api/auth/*splat', async (req, res) => {
  try {
    const origin = getPublicOrigin(req);
    const url = new URL(req.originalUrl, origin);
    const headers = toWebHeaders(req);

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    const webResponse = await auth.handler(webRequest);

    // Copy Web Response headers back to Express res.
    // Set-Cookie must be handled separately: Headers.forEach iterates each
    // set-cookie entry individually, and repeated res.setHeader calls for the
    // same header name overwrite previous values. getSetCookie() returns them
    // as an array which res.setHeader handles correctly (one header line each).
    const setCookies = webResponse.headers.getSetCookie();
    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }
    webResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') {
        res.setHeader(key, value);
      }
    });
    res.status(webResponse.status);

    const body = await webResponse.text();
    if (body) {
      res.send(body);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('[Auth Handler Error]', error);
    res.status(500).json({ error: 'Auth handler failed' });
  }
});

// ---------------------------------------------------------------------------
// Auth session endpoint (used by SPA root route to check auth)
// ---------------------------------------------------------------------------
app.get('/api/auth-session/get', async (req, res) => {
  try {
    const headers = toWebHeaders(req);
    const session = await auth.api.getSession({ headers });
    res.json(session);
  } catch {
    res.json(null);
  }
});

// ---------------------------------------------------------------------------
// Protected API routes — auth + tenant middleware applied to all /api/* below
// ---------------------------------------------------------------------------
app.use('/api', authMiddleware, tenantMiddleware);

// Lazy-load route modules to keep startup fast and avoid circular deps
async function registerRoutes() {
  const { default: jobsRouter } = await import('./routes/jobs.js');
  const { default: candidatesRouter } = await import('./routes/candidates.js');
  const { default: applicationsRouter } = await import('./routes/applications.js');
  const { default: dashboardRouter } = await import('./routes/dashboard.js');
  const { default: skillsRouter } = await import('./routes/skills.js');
  const { default: experienceRouter } = await import('./routes/experience.js');
  const { default: projectsRouter } = await import('./routes/projects.js');
  const { default: preferencesRouter } = await import('./routes/preferences.js');
  const { default: resumesRouter } = await import('./routes/resumes.js');
  const { default: answersRouter } = await import('./routes/answers.js');
  const { default: notificationsRouter } = await import('./routes/notifications.js');
  const { default: outcomesRouter } = await import('./routes/outcomes.js');
  const { default: aiRouter } = await import('./routes/ai.js');
  const { default: settingsRouter } = await import('./routes/settings.js');
  const { default: analyticsRouter } = await import('./routes/analytics.js');
  const { default: skillGapRouter } = await import('./routes/skill-gap.js');
  const { default: resumeRendererRouter } = await import('./routes/resume-renderer.js');
  const { default: gmailRouter } = await import('./routes/gmail.js');
  const { default: emailAnalysisRouter } = await import('./routes/email-analysis.js');
  const { default: answerAiRouter } = await import('./routes/answer-ai.js');
  const { default: profileCoachRouter } = await import('./routes/profile-coach.js');
  const { default: careerGoalsRouter } = await import('./routes/career-goals.js');
  const { default: coverLetterRouter } = await import('./routes/cover-letter.js');
  const { default: flightRecordsRouter } = await import('./routes/flight-records.js');
  const { default: ghostwriterRouter } = await import('./routes/ghostwriter.js');
  const { default: resumeInterviewRouter } = await import('./routes/resume-interview.js');
  const { default: rxresumeRouter } = await import('./routes/rxresume.js');
  const { default: activityRouter } = await import('./routes/activity.js');

  app.use('/api/jobs', jobsRouter);
  app.use('/api/candidates', candidatesRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/skills', skillsRouter);
  app.use('/api/experience', experienceRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/preferences', preferencesRouter);
  app.use('/api/resumes', resumesRouter);
  app.use('/api/answers', answersRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/outcomes', outcomesRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/skill-gap', skillGapRouter);
  app.use('/api/resume-renderer', resumeRendererRouter);
  app.use('/api/gmail', gmailRouter);
  app.use('/api/email-analysis', emailAnalysisRouter);
  app.use('/api/answer-ai', answerAiRouter);
  app.use('/api/profile-coach', profileCoachRouter);
  app.use('/api/career-goals', careerGoalsRouter);
  app.use('/api/cover-letter', coverLetterRouter);
  app.use('/api/flight-records', flightRecordsRouter);
  app.use('/api/ghostwriter', ghostwriterRouter);
  app.use('/api/resume-interview', resumeInterviewRouter);
  app.use('/api/rxresume', rxresumeRouter);
  app.use('/api/activity', activityRouter);
}

// ---------------------------------------------------------------------------
// Error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
registerRoutes()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`[API] Server running on http://localhost:${PORT}`);
    });

    // Graceful shutdown — flush PostHog events
    const gracefulShutdown = async () => {
      const { shutdown } = await import('./lib/posthog.js');
      await shutdown();
      server.close();
      process.exit(0);
    };
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  })
  .catch((err) => {
    console.error('[API] Failed to register routes:', err);
    process.exit(1);
  });

export default app;
