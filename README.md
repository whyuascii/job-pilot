# Job Pilot

AI-powered job search operating system. Discover roles, score fit, tailor resumes, and track applications with a human-in-the-loop approach.

## Stack

- **Monorepo**: Turborepo + pnpm
- **Frontend**: TanStack Start (SSR) + shadcn/ui + Tailwind CSS v4
- **Database**: PostgreSQL 16 + pgvector + Drizzle ORM
- **AI Orchestration**: Mastra v1
- **LLM**: Claude API / AWS Bedrock
- **Web Scraping**: Firecrawl
- **Infrastructure**: Docker Compose (Postgres, Redis, MinIO)

## Project Structure

```
apps/
  web/                  # TanStack Start application
packages/
  ui/                   # shadcn component library (sky/pilot theme)
  db/                   # Drizzle ORM schema + migrations
  mastra/               # AI agents + workflows
  shared/               # Shared types + Zod validators
  config-tailwind/      # Shared Tailwind config + theme
  config-typescript/    # Shared TypeScript configs
docker/
  docker-compose.yml    # Local development services
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm 9.x
- Docker & Docker Compose

### Setup

```bash
# Install dependencies
pnpm install

# Start local services (Postgres, Redis, MinIO)
docker compose -f docker/docker-compose.yml up -d

# Copy environment file
cp .env.example .env

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ANTHROPIC_API_KEY` - Claude API key
- `FIRECRAWL_API_KEY` - Firecrawl API key
- `S3_*` - MinIO/S3 storage credentials

## Architecture

Job Pilot is built around seven layers:

1. **Candidate Knowledge** - Canonical profile as source of truth
2. **Job Ingestion** - Firecrawl + API adapters + RSS
3. **Normalization** - Raw postings to typed validated records
4. **Scoring** - Two-pass: Fit/desirability + Competitiveness
5. **Asset Generation** - Tailored resumes, cover letters, prep notes
6. **Human-in-the-Loop** - Approval flow for submissions + answer review
7. **Tracking & Learning** - Funnel analytics + outcome correlation

## Theme

Aviation/sky/pilot inspired UI with a sky-blue primary palette. Application statuses use aviation terminology (Radar Contact, Cleared for Takeoff, Cruising Altitude, Landed).
