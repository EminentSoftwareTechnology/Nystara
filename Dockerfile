FROM node:22-alpine AS base

# ---- deps: install production dependencies ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- builder: full install + generate + build ----
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# prisma generate must run before next build so @prisma/client types are present
RUN npx prisma generate

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ---- runner: minimal production image ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# standalone output bundles server.js + required node_modules
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# prisma schema is needed by migrate deploy at startup
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
