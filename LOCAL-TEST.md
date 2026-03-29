# Local Testing Guide

## Quick Honest Assessment

**Yes, this is a fully functional product you can run locally.** The core job-tracking workflow (signup, profile, jobs, applications, analytics) works without any external API keys. AI-powered features (scoring, resume tailoring, job URL ingestion) require an Anthropic API key.

---

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9.15 (`npm install -g pnpm`)
- **Docker** + Docker Compose (for Postgres, Redis, MinIO)

---

## Step 1: Start Infrastructure

```bash
docker compose -f docker/docker-compose.yml up -d
```

Wait for all services to be healthy:

```bash
docker compose -f docker/docker-compose.yml ps
```

You should see `jobpilot-postgres`, `jobpilot-redis`, and `jobpilot-minio` all healthy.

| Service    | Port  | Purpose                          |
|------------|-------|----------------------------------|
| PostgreSQL | 5432  | Database (pgvector enabled)      |
| Redis      | 6379  | Caching (optional, degrades gracefully) |
| MinIO      | 9000  | S3-compatible file storage       |
| MinIO UI   | 9001  | MinIO admin console              |

---

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set a `BETTER_AUTH_SECRET` (required for auth to work):

```env
# Required (already set with defaults for local Docker):
DATABASE_URL=postgresql://jobpilot:jobpilot@localhost:5432/jobpilot
REDIS_URL=redis://:jobpilot@localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=job-pilot
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
APP_URL=http://localhost:5173
SESSION_SECRET=change-me-in-production-at-least-32-chars!!

# Add this line (better-auth reads it automatically):
BETTER_AUTH_SECRET=local-dev-secret-must-be-at-least-32-characters-long

# Optional - enables AI features:
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
```

---

## Step 3: Install Dependencies

```bash
pnpm install
```

---

## Step 4: Push Database Schema

```bash
pnpm db:push
```

This creates all tables in Postgres using Drizzle ORM's push command (no migration files needed for dev).

---

## Step 5: Start Dev Servers

```bash
pnpm dev
```

This starts both servers via Turborepo:

| App      | URL                        | What it runs              |
|----------|----------------------------|---------------------------|
| Frontend | http://localhost:5173       | Vite SPA (React)          |
| API      | http://localhost:3001       | Express REST API          |

The Vite dev server proxies all `/api/*` requests to Express automatically.

---

## Step 6: Create Your Account

1. Open **http://localhost:5173**
2. You'll be redirected to the **login page**
3. Click **"Sign up"**
4. Enter your name, email, and password (min 8 chars)
5. You'll be redirected to the **Flight Deck** (dashboard)

> The signup process automatically creates your workspace (tenant) and candidate profile.

---

## Step 7: Set Up Your Profile

Navigate to **Pilot Profile** in the sidebar.

Fill in your professional details:
- **Headline** and **Summary**
- **Current title**, **company**, **location**
- **Years of experience**, **salary range**, **remote preference**

### Add Skills
Scroll to the Skills section and add your technical skills with:
- Category (language, framework, tool, platform, methodology)
- Confidence score (0-100)
- Years used

### Add Experience
Add your work history:
- Company, title, dates
- Description and bullet points
- Skills used at each role

### Add Projects
Add portfolio projects with descriptions, URLs, and skills used.

### Add Preferences
Set job search preferences (target roles, locations, salary expectations, etc.)

---

## Step 8: Add Jobs

### Option A: Manual Entry (no API key needed)
1. Go to **Radar** (Jobs) in the sidebar
2. Click **"Add Job"**
3. Fill in company, title, location, compensation, required skills, etc.
4. Save

### Option B: Add from URL (requires ANTHROPIC_API_KEY)
1. Go to **Radar** (Jobs)
2. Click **"Add from URL"**
3. Paste a job posting URL
4. AI will scrape the page and parse the job details automatically
5. The job gets scored against your profile automatically

---

## Step 9: Score Jobs (requires ANTHROPIC_API_KEY)

If you have an API key configured:
- Jobs added via URL are scored automatically
- For manually-added jobs, click **"Score"** on the job detail page
- Scoring runs a two-pass AI analysis (fit score + competitiveness score)
- View the breakdown by clicking into any job

---

## Step 10: Create Applications

1. Open a job from the **Radar** page
2. Click **"Apply"** to create an application
3. Track your status through the pipeline:
   - Discovered → Applied → Phone Screen → Technical → Onsite → Offer → Accepted/Rejected

### Update Status
1. Go to **Flight Log** (Applications)
2. Click into an application
3. Change the status dropdown
4. Optionally add notes for each stage transition

---

## Step 11: Explore Other Features

### Answer Bank (Hangar)
- Save reusable answers to common application questions
- Organize by category (behavioral, technical, etc.)

### Analytics (Flight Analytics)
- View your application funnel
- Track conversion rates by stage
- See score correlations with outcomes
- Company response rates

### Resume Management
- Upload resumes (stored in MinIO)
- Set a preferred resume
- AI resume tailoring per job (requires API key)
- Side-by-side comparison view

### Settings (Control Tower)
- Configure API keys (encrypted at rest)
- Set up job sources for syncing

### Notifications
- In-app notification bell
- Alerts for status changes and AI completions

---

## What Works Without an API Key

| Feature                        | Works? |
|--------------------------------|--------|
| Signup / Login                 | Yes    |
| Profile management             | Yes    |
| Manual job entry               | Yes    |
| Application tracking           | Yes    |
| Status pipeline                | Yes    |
| Answer bank                    | Yes    |
| Dashboard stats                | Yes    |
| Analytics / funnel             | Yes    |
| Resume upload / download       | Yes    |
| Notifications                  | Yes    |
| Job URL ingestion (AI parse)   | No - needs ANTHROPIC_API_KEY |
| Job scoring                    | No - needs ANTHROPIC_API_KEY |
| Resume parsing from PDF        | No - needs ANTHROPIC_API_KEY |
| Resume tailoring               | No - needs ANTHROPIC_API_KEY |
| Answer AI suggestions          | No - needs ANTHROPIC_API_KEY |
| Email status detection         | No - needs ANTHROPIC_API_KEY |
| Gmail integration              | No - needs Google OAuth credentials |
| Skill gap analysis             | Yes (deterministic, no AI) |

---

## Troubleshooting

### "Cannot connect to database"
```bash
docker compose -f docker/docker-compose.yml ps
# Verify postgres is healthy, then:
docker compose -f docker/docker-compose.yml logs postgres
```

### Auth not working / session not persisting
Make sure `BETTER_AUTH_SECRET` is set in `.env` and both servers are restarted.

### Redis warnings in console
Redis is optional. If it's not running, the app falls back to no caching. This is fine for local testing.

### MinIO / resume upload failing
Check MinIO is running and the `job-pilot` bucket was created:
```bash
docker compose -f docker/docker-compose.yml logs minio-setup
```
You can also visit http://localhost:9001 (minioadmin/minioadmin) to verify.

### Port conflicts
- Frontend: Set `VITE_PORT` or edit `apps/web/vite.config.ts`
- API: Set `API_PORT` env var (default 3001)
- Postgres: Change port mapping in `docker/docker-compose.yml`

### Resetting everything
```bash
docker compose -f docker/docker-compose.yml down -v   # Wipe volumes
docker compose -f docker/docker-compose.yml up -d      # Fresh start
pnpm db:push                                            # Recreate schema
```

---

## Optional: Seed Demo Data

If you want to skip manual setup and see the app populated:

```bash
pnpm db:seed
```

This creates a demo workspace with:
- 15 skills, 3 experience blocks, 1 project, 6 preferences
- 3 sample jobs (Vercel, Stripe, Anthropic) with pre-computed scores
- 1 sample application

> **Note:** The seeded user (`pilot@demo.com`) has a placeholder password hash and **cannot be used to log in**. Create your own account through the signup page - the seed data is for viewing demo jobs/scores only if you connect to the DB directly or modify the seed to use your account's IDs.
