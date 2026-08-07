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

# ملاحظة: sharp يُثبَّت داخل node_modules المرحلة deps على نفس صورة node:22-alpine،
# لذا النسخ من builder لا يكسر التوافق مع alpine/musl.
# لا تضف COPY لـ node_modules من بيئة مختلفة (مثل debian) وإلا سيفشل sharp في الإنتاج.

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 8080

# Railway provides PORT dynamically. Do not bind extra ports here.
#
# استراتيجية قاعدة البيانات عند الإقلاع:
#   - إذا وُجدت ملفات migrations فعلية (مجلدات تحتوي migration.sql داخل prisma/migrations)
#     نستخدم `prisma migrate deploy` — الطريقة الآمنة الموصى بها للإنتاج.
#   - وإلا نرجع مؤقتاً إلى `prisma db push` مع تحذير.
#     تنبيه: `db push` مخصص للتطوير فقط وقد يسبب فقدان بيانات؛ ولّد migrations محلياً
#     عبر `npm run db:migrate` (prisma migrate dev) وادفعها للمستودع (راجع prisma/migrations/README.md).
#   - فشل خطوة قاعدة البيانات لا يمنع إقلاع الخادم (|| true) لتجنّب حلقة إعادة التشغيل،
#     لكن راقب السجلات وأصلح السبب.
CMD ["sh", "-c", "if ls ./prisma/migrations/*/migration.sql >/dev/null 2>&1; then echo '[deploy] applying prisma migrations via migrate deploy'; ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma || true; else echo '[deploy] WARNING: no prisma migrations found; falling back to db push (DEVELOPMENT ONLY - generate migrations with: prisma migrate dev)'; ./node_modules/.bin/prisma db push --schema=./prisma/schema.prisma || true; fi; node .next/standalone/server.js"]
