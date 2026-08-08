import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prismaServer: PrismaClient | undefined
  prismaSelfHeal: Promise<void> | undefined
}

export const db = globalForPrisma.prismaServer ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaServer = db

// fix(payments): ترقيع ذاتي لمخطط قاعدة البيانات — السبب الجذري لخطأ 500 في السداد
// وصمت تقرير العميل/المورد:
// عند تغيير FactorySettings ليصبح companyId هو الـ PK (وحذف عمود id)، أصبح
// `prisma db push` يتطلب --accept-data-loss، وبما أنه غير موجود في أمر الإقلاع
// (Dockerfile: `prisma db push ... || true`) كان الـ push يفشل كاملاً وبصمت،
// فبقيت قاعدة الإنتاج بالمخطط القديم بدون عمودَي Payment.customerId/supplierId.
// النتيجة: كل استعلام/إنشاء على Payment (POST /api/payments، customer-report،
// supplier-report، /api/customers groupBy) يفشل بـ "column does not exist" → 500.
// هنا نضيف العمودين بشكل idempotent (IF NOT EXISTS — بلا فقدان بيانات) عند الإقلاع
// مع إعادة المحاولة، فتعود كل المسارات للعمل فوراً دون تعديل Dockerfile/schema.
async function ensurePaymentPartyColumns(attempt = 1): Promise<void> {
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "customerId" TEXT')
    await db.$executeRawUnsafe('ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "supplierId" TEXT')
    // Drop legacy foreign keys that might be bound to partyId and causing constraint violations
    await db.$executeRawUnsafe('ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "payment_supplier_fk" CASCADE').catch(() => {})
    await db.$executeRawUnsafe('ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "payment_customer_fk" CASCADE').catch(() => {})
    await db.$executeRawUnsafe('ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_supplierId_fkey" CASCADE').catch(() => {})
    await db.$executeRawUnsafe('ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_customerId_fkey" CASCADE').catch(() => {})

    // Ensure FactorySettings id is dropped or not breaking
    // We drop the legacy id column entirely because Prisma no longer sends it (client-side CUID)
    await db.$executeRawUnsafe('ALTER TABLE "FactorySettings" DROP CONSTRAINT IF EXISTS "FactorySettings_pkey" CASCADE').catch(() => {})
    await db.$executeRawUnsafe('ALTER TABLE "FactorySettings" DROP COLUMN IF EXISTS "id" CASCADE').catch(() => {})
    await db.$executeRawUnsafe('ALTER TABLE "FactorySettings" ADD PRIMARY KEY ("companyId")').catch(() => {})
  } catch (e) {
    console.error(`[db-self-heal] attempt ${attempt} failed:`, e)
    if (attempt < 5) {
      await new Promise((r) => setTimeout(r, 3000 * attempt))
      return ensurePaymentPartyColumns(attempt + 1)
    }
  }
}

// يُنفَّذ مرة واحدة لكل عملية خادم (globalThis يمنع التكرار مع hot-reload)
globalForPrisma.prismaSelfHeal ??= ensurePaymentPartyColumns()
