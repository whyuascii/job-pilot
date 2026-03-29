# syntax=docker/dockerfile:1

# Base stage
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/mastra/package.json ./packages/mastra/
COPY packages/config-tailwind/package.json ./packages/config-tailwind/
COPY packages/config-typescript/package.json ./packages/config-typescript/
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST=https://us.i.posthog.com
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY
ENV VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/config-tailwind/node_modules ./packages/config-tailwind/node_modules
COPY --from=deps /app/packages/config-typescript/node_modules ./packages/config-typescript/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/mastra/node_modules ./packages/mastra/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY . .
RUN pnpm turbo build --filter=@job-pilot/web

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 jobpilot

COPY --from=builder --chown=jobpilot:nodejs /app/apps/web/.output ./.output

USER jobpilot

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", ".output/server/index.mjs"]
