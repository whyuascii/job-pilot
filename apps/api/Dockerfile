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
# Production stage — lightweight Alpine image
# ---------------------------------------------------------------------------
FROM node:20-alpine
WORKDIR /app

RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D api

# Copy everything from builder (includes node_modules, built output)
COPY --from=builder --chown=api:nodejs /app /app

USER api

ENV NODE_ENV=production

EXPOSE 3001

WORKDIR /app/apps/api

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "--import", "tsx", "dist/main.js"]
