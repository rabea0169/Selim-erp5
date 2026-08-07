import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'
import { assertValidPaid } from '@/lib/calc'

// GET /api/sales/[id] — جلب فاتورة بيع واحدة (معزولة بالشركة)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params

    // findFirst بدلاً من findUnique لضمان تبعية الفاتورة للشركة الحالية (حماية IDOR)
    const sale = await db.sale.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }
    return NextResponse.json({ sale })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

// PUT /api/sales/[id] — تحديث المدفوع على الفاتورة (استلام دفعة)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params
    const body = await req.json()

    // التحقق من وجود الفاتورة داخل نفس الشركة (حماية IDOR)
    const existing = await db.sale.findFirst({ where: { id, companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    const data: any = { updatedAt: new Date() }

    // تحديث المدفوع مع منع paid > total والقيم السالبة
    if (body.paid !== undefined) {
      const paidAmount = Number(body.paid)
      if (isNaN(paidAmount)) {
        return NextResponse.json({ error: 'المبلغ المدفوع غير صالح' }, { status: 400 })
      }
      const paidError = assertValidPaid(paidAmount, existing.total)
      if (paidError) {
        return NextResponse.json({ error: paidError }, { status: 400 })
      }
      data.paid = paidAmount
    }

    if (body.notes !== undefined) {
      data.notes = body.notes?.trim?.() || null
    }

    const sale = await db.sale.update({
      where: { id },
      data,
      include: { items: true },
    })
    return NextResponse.json({ sale })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params

    // جلب الفاتورة مع أصنافها — داخل الشركة فقط
    const sale = await db.sale.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // 1) إرجاع كميات المنتجات للمخزون
      for (const item of sale.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity }, updatedAt: new Date() },
          })
        }
      }

      // 2) حذف حركة الخزينة المرتبطة (إيداع المبيعات) — داخل الشركة فقط
      if (sale.paid > 0) {
        await tx.treasuryTransaction.deleteMany({
          where: { referenceType: 'sale', referenceId: id, companyId },
        })
      }

      // 3) حذف المدفوعات المرتبطة بالفاتورة
      await tx.payment.deleteMany({
        where: { invoiceId: id, companyId },
      })

      // 4) حذف المرتجعات المرتبطة
      const returnIds = await tx.saleReturn.findMany({
        where: { saleId: id, companyId },
        select: { id: true },
      })
      if (returnIds.length > 0) {
        const ids = returnIds.map(r => r.id)
        // حذف حركات الخزينة للمرتجعات
        await tx.treasuryTransaction.deleteMany({
          where: { referenceType: 'sale_return', referenceId: { in: ids }, companyId },
        })
        await tx.saleReturn.deleteMany({ where: { id: { in: ids } } })
      }

      // 5) حذف أصناف الفاتورة ثم الفاتورة نفسها
      await tx.saleItem.deleteMany({ where: { saleId: id } })
      await tx.sale.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
