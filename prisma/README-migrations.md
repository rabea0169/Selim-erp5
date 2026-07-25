# تاريخ الهجرات (Migrations)

المشروع كان ينشر بـ`prisma db push` بدون تاريخ هجرات. تمت إضافة هجرة أساسية (`init`) تمثّل الـschema الحالي.

## قاعدة بيانات جديدة (فارغة)
```sh
npx prisma migrate deploy
```

## قاعدة بيانات موجودة بها بيانات (مثل Railway)
1. نظّف التكرارات التي كانت مسموحة قبل القيود الجديدة:
   ```sh
   psql "$DATABASE_URL" -f prisma/dedupe-before-constraints.sql
   ```
2. طبّق القيود الجديدة مرة واحدة:
   ```sh
   npx prisma db push --accept-data-loss
   ```
   (`--accept-data-loss` هنا فقط لحذف عمود `Payment.partyId` غير القابل للاستخدام.)
3. اعتبر الهجرة الأساسية مُطبَّقة حتى تعمل `migrate deploy` مستقبلًا:
   ```sh
   npx prisma migrate resolve --applied 20260725212801_init
   ```
4. بعد نجاح الخطوات السابقة يمكن تغيير أمر التشغيل في `Dockerfile` من
   `prisma db push --skip-generate` إلى `prisma migrate deploy`.

> ملاحظة: `Payment.partyId` تم استبداله بعمودَي `customerId` و`supplierId`؛ الجدول كان غير قابل للكتابة أصلًا (كل صف كان يخالف أحد المفتاحين الأجنبيين) فلا توجد بيانات لترحيلها.
