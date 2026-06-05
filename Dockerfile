# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────
# Agentic OS — production image
# Multi-stage: deps → build → runtime. Final image ~150 MB.
# Built on Node 24 (required for built-in node:sqlite used by Kanban).
# ─────────────────────────────────────────────────────────────────────────

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for the app process
RUN addgroup -S app && adduser -S app -G app
RUN mkdir -p /app/.data /app/.config && chown -R app:app /app

# Standalone bundle includes only the deps actually used at runtime.
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

USER app
EXPOSE 3000

# Persistent state lands here; mount as a volume to survive container restarts.
VOLUME ["/app/.data"]

CMD ["node", "server.js"]
