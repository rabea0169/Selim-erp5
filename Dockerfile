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

COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/prisma ./.next/standalone/prisma/
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./.next/standalone/
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/standalone/.next/static/
COPY --from=builder /app/public ./.next/standalone/public/

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 8080

# Railway provides PORT dynamically. Do not bind extra ports here.
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema=./prisma/schema.prisma || true; node .next/standalone/server.js"]
