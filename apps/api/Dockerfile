FROM node:20-slim AS builder
WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json files for dependency resolution
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/mastra/package.json packages/mastra/
COPY packages/config-typescript/package.json packages/config-typescript/

# Install pnpm and dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ apps/api/
COPY packages/db/ packages/db/
COPY packages/shared/ packages/shared/
COPY packages/mastra/ packages/mastra/
COPY packages/config-typescript/ packages/config-typescript/
COPY tsconfig.json ./

# Build workspace packages then api
RUN pnpm --filter @job-pilot/shared build || true && \
    pnpm --filter @job-pilot/db build || true && \
    pnpm --filter @job-pilot/mastra build || true && \
    pnpm --filter @job-pilot/api build

# ---------------------------------------------------------------------------
# Production stage — Playwright-compatible image
# ---------------------------------------------------------------------------
# node:20-slim is Debian-based (not Alpine) which supports glibc needed by
# Chromium. We install Playwright's system dependencies for headless Chrome.
FROM node:20-slim
WORKDIR /app

# Install system dependencies for Playwright Chromium (headless)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Chromium runtime dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libwayland-client0 \
    # Font rendering
    fonts-liberation \
    fonts-noto-color-emoji \
    # Utilities
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 nodejs && useradd -m -u 1001 -g nodejs api

# Copy everything from builder (includes node_modules, built output)
COPY --from=builder --chown=api:nodejs /app /app

# Install Playwright browsers (Chromium only — saves ~500MB vs all browsers)
RUN npx playwright install chromium

# Create directories for screenshots and temp files
RUN mkdir -p /tmp/job-pilot-screenshots && chown api:nodejs /tmp/job-pilot-screenshots

USER api

# Production defaults: headless mode, no display needed
ENV NODE_ENV=production
ENV AUTO_APPLY_HEADED=false

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
