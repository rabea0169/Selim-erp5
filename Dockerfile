FROM node:20-alpine AS base

# ===== التثبيت =====
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
RUN npm install

# ===== توليد Prisma =====
FROM base AS prisma
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma/
RUN npx prisma generate

# ===== البناء =====
FROM base AS builder
WORKDIR /app
COPY --from=prisma /app/node_modules ./node_modules
COPY . .
RUN npx prisma db push --accept-data-loss 2>/dev/null || true
RUN npm run build

# ===== التشغيل =====
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
