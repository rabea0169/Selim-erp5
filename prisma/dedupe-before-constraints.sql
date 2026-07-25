-- يُشغَّل مرة واحدة على قاعدة بيانات موجودة قبل تطبيق القيود الفريدة الجديدة.
-- يحذف/يعدّل التكرارات التي كانت مسموحة قبل إضافة @@unique.

-- 1) حضور مكرر لنفس الموظف في نفس اليوم: نُبقي الأحدث
DELETE FROM "WorkerAttendance" a
USING "WorkerAttendance" b
WHERE a."workerId" = b."workerId"
  AND a."date" = b."date"
  AND a."createdAt" < b."createdAt";

-- 2) بنود مصروفات مكررة بنفس الاسم داخل الشركة: نُبقي الأقدم ونحوّل مصروفاتها
UPDATE "Expense" e
SET "categoryId" = keep.id
FROM "ExpenseCategory" dup
JOIN LATERAL (
  SELECT c.id FROM "ExpenseCategory" c
  WHERE c."companyId" = dup."companyId" AND c."name" = dup."name"
  ORDER BY c."createdAt" ASC LIMIT 1
) keep ON TRUE
WHERE e."categoryId" = dup.id AND dup.id <> keep.id;

DELETE FROM "ExpenseCategory" c
USING "ExpenseCategory" k
WHERE c."companyId" = k."companyId" AND c."name" = k."name" AND c."createdAt" > k."createdAt";

-- 3) مخازن مكررة بنفس الاسم داخل الشركة: نعيد تسمية الأحدث بدل حذفه (لأنه قد يحوي مخزونًا)
UPDATE "Warehouse" w
SET "name" = w."name" || ' (' || left(w.id, 4) || ')'
WHERE EXISTS (
  SELECT 1 FROM "Warehouse" o
  WHERE o."companyId" = w."companyId" AND o."name" = w."name" AND o."createdAt" < w."createdAt"
);

-- 4) أرقام فواتير مكررة داخل الشركة: نُلحق لاحقة بالأحدث
UPDATE "Sale" s
SET "invoiceNo" = s."invoiceNo" || '-' || left(s.id, 4)
WHERE s."invoiceNo" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "Sale" o
  WHERE o."companyId" = s."companyId" AND o."invoiceNo" = s."invoiceNo" AND o."createdAt" < s."createdAt"
);

UPDATE "Purchase" p
SET "invoiceNo" = p."invoiceNo" || '-' || left(p.id, 4)
WHERE p."invoiceNo" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "Purchase" o
  WHERE o."companyId" = p."companyId" AND o."invoiceNo" = p."invoiceNo" AND o."createdAt" < p."createdAt"
);
