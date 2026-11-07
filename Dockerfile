# syntax=docker/dockerfile:1
# Image produksi The Mafia Travel (Next.js standalone + Prisma).
# Target: `runner` (default, aplikasi) dan `migrator` (menjalankan prisma migrate deploy).

FROM node:20-alpine AS base
# Prisma di Alpine membutuhkan openssl; libc6-compat untuk binary native.
RUN apk add --no-cache libc6-compat openssl

# ── deps: install dependency (schema Prisma wajib ada karena postinstall = prisma generate)
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ── builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variabel NEXT_PUBLIC_* DIBUNDEL ke JavaScript saat build: harus diberikan di sini.
# Mengubahnya di runtime tidak berpengaruh; ubah lalu build ulang image.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
ARG NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false
ARG NEXT_PUBLIC_WHATSAPP_SUPPORT
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=$NEXT_PUBLIC_MIDTRANS_CLIENT_KEY \
    NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=$NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION \
    NEXT_PUBLIC_WHATSAPP_SUPPORT=$NEXT_PUBLIC_WHATSAPP_SUPPORT \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── migrator: `docker compose run --rm migrate` / one-off job
FROM base AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

# ── runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
