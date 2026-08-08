import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// GET /api/payments/[id] — جلب سجل سداد واحد (مقيد بالشركة)
// يستخدمه paymentRepository.delete لمعرفة نوع السداد قبل الحذف وإرسال الأحداث الصحيحة
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId
    const { id } = await params

    const payment = await db.payment.findFirst({ where: { id, companyId } })
    if (!payment) {
      return NextResponse.json({ error: 'سجل السداد غير موجود' }, { status: 404 })
    }
    // الريبو العميل (BaseRepository.getById) يعيد الاستجابة كما هي
    return NextResponse.json(payment)
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId
    const { id } = await params

    // جلب سجل السداد — داخل الشركة فقط
    const payment = await db.payment.findFirst({
      where: { id, companyId },
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'سجل السداد غير موجود' },
        { status: 404 }
      )
    }

    // تنفيذ الحذف في transaction واحد
    await db.$transaction(async (tx: any) => {
      // التراجع عن تحديث الفاتورة المرتبطة إن وُجدت
      if (payment.invoiceId) {
        if (payment.type === 'customer_payment') {
          const sale = await tx.sale.findFirst({
            where: { id: payment.invoiceId, companyId },
            select: { id: true, paid: true },
          })
          if (sale) {
            // خصم المبلغ المدفوع مع التأكد من عدم النزول تحت الصفر
            const newPaid = Math.max(0, sale.paid - payment.amount)
            await tx.sale.update({
              where: { id: sale.id },
              data: { paid: newPaid },
            })
          }
        } else if (payment.type === 'supplier_payment') {
          const purchase = await tx.purchase.findFirst({
            where: { id: payment.invoiceId, companyId },
            select: { id: true, paid: true },
          })
          if (purchase) {
            const newPaid = Math.max(0, purchase.paid - payment.amount)
            await tx.purchase.update({
              where: { id: purchase.id },
              data: { paid: newPaid },
            })
          }
        }
      }

      // حذف حركات الخزينة المرتبطة بهذا السداد — داخل الشركة فقط
      await tx.treasuryTransaction.deleteMany({
        where: {
          referenceType: 'payment',
          referenceId: id,
          companyId,
        },
      })

      // حذف سجل السداد
      await tx.payment.delete({
        where: { id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
