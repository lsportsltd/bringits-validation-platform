# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:24-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init openssl

# ── Stage 2: install ALL workspace deps together (npm ci requires this) ───────
FROM base AS dependencies
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/web/package*.json ./apps/web/
RUN npm ci --ignore-scripts

# Copy Prisma schema and generate client
COPY apps/backend/prisma ./apps/backend/prisma
RUN npx --prefix apps/backend prisma generate

# ── Stage 3: build backend ────────────────────────────────────────────────────
FROM dependencies AS build
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/backend/src ./apps/backend/src
RUN npm run build --workspace=apps/backend

# ── Stage 4: build frontend (Next.js standalone) ─────────────────────────────
FROM dependencies AS web-build
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=apps/web

# ── Stage 5: production deps (keep prisma CLI for migrate deploy) ─────────────
FROM dependencies AS prod-deps
RUN npm prune --omit=dev --workspace=apps/backend
RUN npm install --prefix apps/backend --no-save prisma

# ── Stage 6: final runtime image ──────────────────────────────────────────────
FROM base AS production

# Backend compiled output + deps
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=prod-deps /usr/src/app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /usr/src/app/apps/backend/dist ./apps/backend/dist
COPY --from=prod-deps /usr/src/app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma
COPY apps/backend/prisma ./apps/backend/prisma

# Frontend — Next.js standalone
COPY --from=web-build /usr/src/app/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=web-build /usr/src/app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /usr/src/app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3002
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /usr/src/app

USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/backend/dist/main.js"]
