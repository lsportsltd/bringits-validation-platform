# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:24-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init openssl

# ── Stage 2: install all deps ─────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
RUN npm ci --ignore-scripts

# ── Stage 3: generate Prisma client ───────────────────────────────────────────
FROM deps AS prisma
COPY apps/backend/prisma ./apps/backend/prisma
RUN npx --prefix apps/backend prisma generate

# ── Stage 4: build backend ────────────────────────────────────────────────────
FROM prisma AS build-backend
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/backend/src ./apps/backend/src
RUN npm run build:backend

# ── Stage 5: build frontend ───────────────────────────────────────────────────
FROM deps AS build-web
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build:web

# ── Stage 6: production image ─────────────────────────────────────────────────
FROM base AS production

COPY --from=build-backend /usr/src/app/apps/backend/dist ./apps/backend/dist
COPY --from=build-backend /usr/src/app/node_modules ./node_modules
COPY apps/backend/prisma ./apps/backend/prisma

COPY --from=build-web /usr/src/app/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=build-web /usr/src/app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web /usr/src/app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3002
ENV NEXT_TELEMETRY_DISABLED=1

USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/backend/dist/main.js"]
