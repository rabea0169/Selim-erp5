FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps --ignore-scripts
RUN npm rebuild

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
ENV PORT=3000

# Create wrapper scripts for bun and tee to interlace Railway UI overrides automatically
RUN printf '#!/bin/sh\nexport HOSTNAME="0.0.0.0"\nexec node "$@"\n' > /usr/local/bin/bun && chmod +x /usr/local/bin/bun
RUN printf '#!/bin/sh\nexec cat\n' > /usr/local/bin/tee && chmod +x /usr/local/bin/tee

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
