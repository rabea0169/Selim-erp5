-- يُشغَّل مرة واحدة على قاعدة بيانات موجودة قبل تطبيق القيود الفريدة الجديدة.
-- يحذف/يعدّل التكرارات التي كانت مسموحة قبل إضافة @@unique.
-- الترتيب دائمًا (createdAt, id) حتى لا تفلت الصفوف المتساوية في createdAt.

-- 1) حضور مكرر لنفس الموظف في نفس اليوم: نُبقي الأحدث
DELETE FROM "WorkerAttendance"
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY "workerId", "date" ORDER BY "createdAt" DESC, id DESC
    ) AS rn
    FROM "WorkerAttendance"
  ) ranked WHERE rn > 1
);

-- 2) بنود مصروفات مكررة بنفس الاسم داخل الشركة: نُبقي الأقدم ونحوّل مصروفاتها إليه
WITH ranked AS (
  SELECT id, "companyId", "name", first_value(id) OVER (
    PARTITION BY "companyId", "name" ORDER BY "createdAt" ASC, id ASC
  ) AS keep_id
  FROM "ExpenseCategory"
)
UPDATE "Expense" e
SET "categoryId" = r.keep_id
FROM ranked r
WHERE e."categoryId" = r.id AND r.id <> r.keep_id;

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY "companyId", "name" ORDER BY "createdAt" ASC, id ASC
  ) AS rn
  FROM "ExpenseCategory"
)
DELETE FROM "ExpenseCategory" WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) مخازن مكررة بنفس الاسم داخل الشركة: نعيد التسمية بدل الحذف (قد تحوي مخزونًا)
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY "companyId", "name" ORDER BY "createdAt" ASC, id ASC
  ) AS rn
  FROM "Warehouse"
)
UPDATE "Warehouse" w
SET "name" = w."name" || ' (' || r.rn || ')'
FROM ranked r
WHERE w.id = r.id AND r.rn > 1;

-- 4) أرقام فواتير مكررة داخل الشركة: نُلحق ترقيمًا بالأحدث
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY "companyId", "invoiceNo" ORDER BY "createdAt" ASC, id ASC
  ) AS rn
  FROM "Sale" WHERE "invoiceNo" IS NOT NULL
)
UPDATE "Sale" s
SET "invoiceNo" = s."invoiceNo" || '-' || r.rn
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY "companyId", "invoiceNo" ORDER BY "createdAt" ASC, id ASC
  ) AS rn
  FROM "Purchase" WHERE "invoiceNo" IS NOT NULL
)
UPDATE "Purchase" p
SET "invoiceNo" = p."invoiceNo" || '-' || r.rn
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;
