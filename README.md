# Job Pilot

An AI-powered job search companion that helps you find, score, tailor, and apply to jobs with confidence. Built around a human-in-the-loop philosophy -- AI assists at every stage, but you stay in the pilot seat.

## Features

- **AI Job Scoring** -- Automatically scores jobs against your profile for fit and competitiveness using a two-pass evaluation system
- **Resume Tailoring** -- AI generates tailored resumes optimized for each specific job posting
- **Cover Letter Generator** -- AI-written cover letters customized per job, matching your voice and the role's requirements
- **Application Assist** -- Slide-out drawer with profile clipboard, resume preview, cover letter, and ghostwriter chat all in one place
- **Ghostwriter Chat** -- AI chat assistant with full job context for drafting answers, emails, and application responses via SSE streaming
- **Resume Interview** -- Interactive AI session that walks through your resume bullet-by-bullet, suggesting enhancements with accept/reject controls
- **Answer Bank** -- Save and reuse answers to common application questions, with AI-powered suggestions and semantic search
- **Skill Gap Analysis** -- Identifies missing skills between your profile and job requirements with actionable recommendations
- **Profile Coach** -- AI-driven profile analysis that scores your profile completeness and suggests improvements
- **Career Goals** -- Save target roles and generate AI coaching plans to close the gap
- **Flight Analytics** -- Funnel analytics tracking your application pipeline: source effectiveness, score correlation, and resume variant performance
- **Flight Records** -- Detailed log of every application with point-in-time snapshots of the resume and profile used
- **Control Tower Dashboard** -- Command center showing active missions, activity feed, pipeline snapshot, and search summary
- **Profile Management** -- Skills, experience, projects, preferences, and resume uploads with PDF parsing
- **Job Ingestion** -- Add jobs by URL or raw text; AI parses and extracts structured details automatically
- **Email Integration** -- Gmail OAuth for sending introduction, follow-up, and thank-you emails with templates
- **Email Analysis** -- AI-powered analysis of incoming recruiter emails to auto-detect status changes
- **Resume PDF Export** -- Generate polished PDFs via self-hosted RxResume (Reactive Resume) with template selection
- **Notification System** -- In-app notifications for job matches, scoring results, and status changes
- **PostHog Analytics** -- Session replay, heatmaps, feature flags, and web vitals tracking

## Tech Stack

### Frontend

- React 19 + Vite 7
- TanStack Router (file-based client-side routing)
- shadcn/ui + Radix UI primitives
- Tailwind CSS v4 (sky/pilot aviation theme)
- PostHog JS SDK

### Backend

- Express.js 5 API server
- PostgreSQL 16 + pgvector (vector similarity search)
- Drizzle ORM 0.45
- Redis 7 (caching and session management)
- MinIO (S3-compatible object storage)
- better-auth (authentication with session cookies)

### AI

- Claude API via `@anthropic-ai/sdk`
- Mastra framework for agents, tools, and centralized prompts
- Agents: job parser, scoring, resume tailoring, answer assist
- Tools: document parser (PDF vision), web scraper, Claude generic

### Infrastructure

- AWS ECS Fargate (API server)
- S3 + CloudFront (Web SPA static hosting)
- Docker Compose (local development)
- GitHub Actions CI/CD (lint, typecheck, test, build, deploy)
- RxResume + Browserless Chromium (PDF generation)

## Project Structure

```
job-pilot/
├── apps/
│   ├── web/                    # React SPA (Vite + TanStack Router)
│   └── api/                    # Express API server
├── packages/
│   ├── db/                     # Database schema + Drizzle ORM
│   ├── mastra/                 # AI agents, tools, prompts
│   ├── ui/                     # shadcn/ui component library
│   ├── shared/                 # Shared types + Zod validators
│   ├── config-tailwind/        # Tailwind CSS configuration + theme
│   └── config-typescript/      # TypeScript configuration presets
├── docker/                     # Docker Compose + init scripts
├── e2e/                        # Playwright E2E tests
├── .github/workflows/          # CI/CD pipelines
└── docs/                       # Documentation
```

## Prerequisites

- Node.js 20+
- pnpm 9.15+
- Docker and Docker Compose

## Getting Started

### 1. Clone and Install

```bash
git clone <repo-url>
cd job-pilot
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your values. Key variables:

| Variable               | Required | Description                                                             |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`         | Yes      | PostgreSQL connection string                                            |
| `REDIS_URL`            | Yes      | Redis connection string                                                 |
| `BETTER_AUTH_SECRET`   | Yes      | Auth secret (min 32 characters)                                         |
| `ENCRYPTION_KEY`       | No       | AES-256 key for API key encryption (falls back to `BETTER_AUTH_SECRET`) |
| `ANTHROPIC_API_KEY`    | Yes      | Claude API key for all AI features                                      |
| `S3_ENDPOINT`          | Yes      | MinIO/S3 endpoint for file storage                                      |
| `S3_BUCKET`            | Yes      | Storage bucket name                                                     |
| `S3_ACCESS_KEY`        | Yes      | Storage access key                                                      |
| `S3_SECRET_KEY`        | Yes      | Storage secret key                                                      |
| `GOOGLE_CLIENT_ID`     | No       | Gmail OAuth client ID (for email integration)                           |
| `GOOGLE_CLIENT_SECRET` | No       | Gmail OAuth client secret                                               |
| `VITE_POSTHOG_KEY`     | No       | PostHog project API key (for analytics)                                 |

### 3. Start Infrastructure

```bash
docker compose -f docker/docker-compose.yml up -d
```

This starts five services:

| Service                  | Port                       | Description                       |
| ------------------------ | -------------------------- | --------------------------------- |
| PostgreSQL 16 + pgvector | 5432                       | Primary database                  |
| Redis 7                  | 6379                       | Caching layer                     |
| MinIO                    | 9000 (API), 9001 (Console) | S3-compatible object storage      |
| RxResume                 | 3100                       | Resume PDF generation engine      |
| Browserless Chromium     | 3200                       | Headless browser for PDF printing |

### 4. Database Setup

```bash
pnpm db:push
```

This pushes the Drizzle schema directly to your local PostgreSQL instance.

### 5. Start Development

Start both the web app and API server in parallel:

```bash
pnpm dev
```

Or start them individually:

```bash
pnpm --filter @job-pilot/web dev    # Web at http://localhost:5173
pnpm --filter @job-pilot/api dev    # API at http://localhost:3001
```

The Vite dev server proxies all `/api/*` requests to the Express API server at port 3001.

### 6. Open the App

Visit [http://localhost:5173](http://localhost:5173) to create an account and get started.

## Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Start all services in development mode       |
| `pnpm build`        | Build all packages and apps                  |
| `pnpm test`         | Run all unit tests (Vitest)                  |
| `pnpm test:watch`   | Run tests in watch mode                      |
| `pnpm test:e2e`     | Run Playwright end-to-end tests              |
| `pnpm type-check`   | TypeScript type checking across all packages |
| `pnpm format`       | Format code with Prettier                    |
| `pnpm format:check` | Check code formatting                        |
| `pnpm db:push`      | Push Drizzle schema to database              |
| `pnpm db:generate`  | Generate Drizzle migration files             |
| `pnpm db:migrate`   | Run database migrations                      |
| `pnpm db:studio`    | Open Drizzle Studio (database GUI)           |
| `pnpm db:seed`      | Seed database with sample data               |
| `pnpm clean`        | Remove build artifacts and Turbo cache       |

## Architecture

```
┌─────────────┐       ┌──────────────┐       ┌──────────────┐
│  React SPA  │──────>│  Express API │──────>│  PostgreSQL  │
│  (Vite)     │  /api │  (Port 3001) │       │  + pgvector  │
│  Port 5173  │       │              │──────>│              │
└─────────────┘       │              │       └──────────────┘
                      │              │──────>┌──────────────┐
                      │              │       │    Redis     │
                      │              │       └──────────────┘
                      │              │──────>┌──────────────┐
                      │              │       │ MinIO (S3)   │
                      │              │       └──────────────┘
                      │              │──────>┌──────────────┐
                      │              │       │  Claude API  │
                      │              │       └──────────────┘
                      │              │──────>┌──────────────┐
                      │              │       │  RxResume +  │
                      └──────────────┘       │  Chromium    │
                                             └──────────────┘
```

- **Web SPA** makes HTTP requests to the Express API via `/api` proxy
- **Express API** handles all business logic, database access, AI operations, and third-party integrations
- **Authentication** via better-auth with session cookies and automatic tenant + candidate creation on signup
- **AI pipeline** uses centralized prompts from the Mastra package with specialized agents for parsing, scoring, tailoring, and answer generation
- **Production**: Web is deployed as a static SPA to S3 + CloudFront; API runs on ECS Fargate

## Theme

Aviation-inspired UI with a sky-blue primary palette. The application uses pilot/flight terminology throughout:

- **Control Tower** -- Dashboard and command center
- **Flight Records** -- Application history log
- **Flight Analytics** -- Pipeline and funnel metrics
- **Missions** -- Active applications in progress

## Built By

- [eduardoverde.com](https://eduardoverde.com)
- [whyuascii.com](https://whyuascii.com)
