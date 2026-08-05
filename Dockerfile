FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps
RUN npx prisma generate

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npx next build
RUN mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"

# Copy schema and standalone build
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/prisma ./.next/standalone/prisma/
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./.next/standalone/
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/standalone/.next/static/
COPY --from=builder /app/public ./.next/standalone/public/

# Wrapper scripts for Railway: automatically push Prisma schema to DB on container boot
RUN printf '#!/bin/sh\nexport HOSTNAME="0.0.0.0"\n(npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss || true)\nexec node "$@"\n' > /usr/local/bin/bun && chmod +x /usr/local/bin/bun
RUN printf '#!/bin/sh\nexec cat\n' > /usr/local/bin/tee && chmod +x /usr/local/bin/tee

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss || true; node .next/standalone/server.js"]
