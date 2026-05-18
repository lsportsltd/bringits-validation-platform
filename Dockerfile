# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init openssl

# ── Stage 2: install all deps (workspace-aware) ───────────────────────────────
FROM base AS dependencies
# Copy workspace manifests first for layer caching
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/web/package*.json ./apps/web/
RUN npm ci --workspace=apps/backend --ignore-scripts

# Copy Prisma schema and generate client
COPY apps/backend/prisma ./apps/backend/prisma
RUN npx --prefix apps/backend prisma generate

# ── Stage 3: build backend ────────────────────────────────────────────────────
FROM dependencies AS build
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/backend/src ./apps/backend/src
RUN npm run build --workspace=apps/backend

# ── Stage 4: build frontend (Next.js static export) ──────────────────────────
FROM base AS web-build
COPY apps/web/package*.json ./apps/web/
COPY package*.json ./
RUN npm ci --workspace=apps/web --ignore-scripts
COPY apps/web ./apps/web
# Build Next.js — outputs to apps/web/.next
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=apps/web

# ── Stage 5: production deps only ─────────────────────────────────────────────
FROM dependencies AS prod-deps
RUN npm prune --omit=dev --workspace=apps/backend

# ── Stage 6: final runtime image ──────────────────────────────────────────────
FROM base AS production

# Backend
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=prod-deps /usr/src/app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /usr/src/app/apps/backend/dist ./apps/backend/dist
COPY --from=prod-deps /usr/src/app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma
COPY apps/backend/prisma ./apps/backend/prisma

# Frontend — Next.js standalone output
COPY --from=web-build /usr/src/app/apps/web/.next ./apps/web/.next
COPY --from=web-build /usr/src/app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3002

WORKDIR /usr/src/app

USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/backend/dist/main.js"]
