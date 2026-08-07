import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyScope } from '@/lib/company-scope'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // جلب سجل السداد
    const payment = await db.payment.findUnique({
      where: { id },
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'سجل السداد غير موجود' },
        { status: 404 }
      )
    }

    // تنفيذ الحذف في transaction واحد
    await db.$transaction(async (tx) => {
      // التراجع عن تحديث الفاتورة المرتبطة إن وُجدت
      if (payment.invoiceId) {
        if (payment.type === 'customer_payment') {
          // التحقق من وجود الفاتورة قبل تعديلها
          const sale = await tx.sale.findUnique({
            where: { id: payment.invoiceId },
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
          // التحقق من وجود الفاتورة قبل تعديلها
          const purchase = await tx.purchase.findUnique({
            where: { id: payment.invoiceId },
            select: { id: true, paid: true },
          })
          if (purchase) {
            // خصم المبلغ المدفوع مع التأكد من عدم النزول تحت الصفر
            const newPaid = Math.max(0, purchase.paid - payment.amount)
            await tx.purchase.update({
              where: { id: purchase.id },
              data: { paid: newPaid },
            })
          }
        }
      }

      // حذف حركات الخزينة المرتبطة بهذا السداد
      await tx.treasuryTransaction.deleteMany({
        where: {
          referenceType: 'payment',
          referenceId: id,
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
