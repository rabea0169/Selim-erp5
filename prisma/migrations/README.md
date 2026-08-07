# مجلد Prisma Migrations

هذا المجلد مخصص لملفات الهجرات (migrations) الخاصة بقاعدة البيانات.

## لماذا؟
في الإنتاج يستخدم Dockerfile الأمر `prisma migrate deploy` إذا وُجدت migrations فعلية
(مجلدات تحتوي `migration.sql`)، وإلا يرجع مؤقتاً إلى `prisma db push` مع تحذير.
`db push` مخصص للتطوير فقط وقد يسبب فقدان بيانات — لا تعتمد عليه في الإنتاج.

## كيف تولّد migrations محلياً؟
1. تأكد من ضبط `DATABASE_URL` في ملف `.env` على قاعدة بيانات التطوير (وليس الإنتاج).
2. عدّل `prisma/schema.prisma` حسب الحاجة.
3. نفّذ:
   ```bash
   npm run db:migrate -- --name وصف_التغيير
   # أي: npx prisma migrate dev --name وصف_التغيير
   ```
4. سيُنشأ مجلد جديد مثل `prisma/migrations/20260101000000_وصف_التغيير/` يحتوي `migration.sql`.
5. راجع ملف SQL ثم ادفع (commit) مجلد `prisma/migrations` كاملاً مع التغييرات.

## ملاحظة مهمة لأول migration
إذا كانت قاعدة بيانات الإنتاج الحالية قد أُنشئت سابقاً عبر `db push`، فبعد توليد أول
migration ستحتاج لتمييزها كمُطبَّقة على الإنتاج مرة واحدة فقط:
```bash
npx prisma migrate resolve --applied "<اسم_مجلد_الهجرة>"
```
ثم ستعمل عمليات `migrate deploy` اللاحقة تلقائياً عند كل نشر.

## لا تفعل
- لا تعدّل ملفات `migration.sql` بعد دفعها وتطبيقها على الإنتاج.
- لا تحذف مجلدات migrations قديمة.
- لا تشغّل `prisma migrate dev` موجّهاً لقاعدة الإنتاج.
