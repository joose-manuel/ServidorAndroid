# =============================================================================
# Multi-stage Dockerfile for apps/api (NestJS 10)
# Build context = repo root
# =============================================================================

# -------- 1. Build deps --------
FROM node:20-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
COPY nx.json tsconfig.base.json tsconfig.json ./
COPY apps/api ./apps/api
COPY libs ./libs
RUN npm ci --no-audit --no-fund

# -------- 2. Build --------
FROM deps AS build
WORKDIR /repo
RUN npx nx build api --configuration=production

# -------- 3. Prune dev deps for runtime --------
FROM build AS prune
WORKDIR /repo
RUN npm prune --omit=dev

# -------- 4. Runtime --------
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3000

RUN apk add --no-cache tini curl dumb-init \
    && addgroup -S app && adduser -S app -G app

# Bring in the pruned node_modules + built app
COPY --from=prune --chown=app:app /repo/node_modules ./node_modules
COPY --from=prune --chown=app:app /repo/dist/apps/api ./dist
COPY --from=prune --chown=app:app /repo/apps/api/package.json ./apps/api/package.json

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/apps/api/src/main.js"]
