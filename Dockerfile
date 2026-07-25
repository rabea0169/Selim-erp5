FROM node:20-alpine AS base

# تثبيت مكتبات النظام المطلوبة لـ sharp
RUN apk add --no-cache vips-dev

# ===== التثبيت =====
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

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
RUN npm run build

# ===== التشغيل =====
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# تثبيت Prisma لتشغيل db push عند البدء (نفس نسخة المشروع)
RUN npm install prisma@6.19.3 @prisma/client@6.19.3 --no-save --legacy-peer-deps

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma/

EXPOSE 3000

# مزامنة الجداول بدون حذف البيانات ثم تشغيل السيرفر
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate && node server.js"]
