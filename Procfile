# ينفّذ migrations الآمنة عند الإقلاع إن وُجدت، وإلا يرجع مؤقتاً لـ db push (للتطوير فقط)
web: sh -c 'if ls ./prisma/migrations/*/migration.sql >/dev/null 2>&1; then ./node_modules/.bin/prisma migrate deploy || true; else ./node_modules/.bin/prisma db push || true; fi; HOSTNAME=0.0.0.0 node .next/standalone/server.js'
