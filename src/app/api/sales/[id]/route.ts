import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { computeInvoiceTotals } from '@/lib/invoice-totals'

interface SaleItem {
  itemName: string
  productId?: string | null
  priceType?: string | null
  quantity: number
  unitPrice: number
}

// PUT /api/sales/[id] - تعديل فاتورة مبيعات
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth('update')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const existingSale = await db.sale.findFirst({
      where: { id, companyId: auth.companyId },
      include: { items: true },
    })
    if (!existingSale) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    const body = await req.json()
    const {
      customerName,
      customerId_ref,
      invoiceNo,
      date,
      items,
      paid,
      notes,
      discountType,
      discountValue,
      taxRate,
      extraFees,
    } = body

    if (!customerName?.trim()) {
      return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'يجب إضافة صنف واحد على الأقل' }, { status: 400 })
    }

    const validItems: SaleItem[] = items.filter(
      (it: SaleItem) => it.itemName?.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0
    )
    if (validItems.length === 0) {
      return NextResponse.json({ error: 'أضف صنفاً صحيحاً واحداً على الأقل' }, { status: 400 })
    }

    const subtotal = validItems.reduce(
      (sum, it) => sum + Number(it.quantity) * Number(it.unitPrice),
      0
    )
    const totals = computeInvoiceTotals({ subtotal, discountType, discountValue, taxRate, extraFees })
    const paidAmount = Number(paid) || 0

    if (customerId_ref) {
      const customer = await db.customer.findFirst({
        where: { id: customerId_ref, companyId: auth.companyId },
      })
      if (!customer) {
        return NextResponse.json({ error: 'العميل المحدد غير موجود' }, { status: 400 })
      }
    }

    const updatedSale = await db.$transaction(async (tx) => {
      // 1. إعادة المخزون القديم
      for (const item of existingSale.items) {
        if (!item.productId) continue
        await tx.product.updateMany({
          where: { id: item.productId, companyId: auth.companyId },
          data: { quantity: { increment: item.quantity } },
        })
      }

      // 2. حذف حركة الخزينة القديمة
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'sale', referenceId: existingSale.id, companyId: auth.companyId },
      })

      // 3. تحديث الفاتورة + حذف الأصناف القديمة وإعادة إنشائها
      const updated = await tx.sale.update({
        where: { id },
        data: {
          customerName: customerName.trim(),
          customerId_ref: customerId_ref || null,
          invoiceNo: invoiceNo?.trim() || null,
          date: new Date(date),
          subtotal: totals.subtotal,
          discountType: discountType || null,
          discountValue: Number(discountValue) || 0,
          discountAmount: totals.discountAmount,
          taxRate: Number(taxRate) || 0,
          taxAmount: totals.taxAmount,
          extraFees: totals.extraFees,
          total: totals.total,
          paid: paidAmount,
          notes: notes?.trim() || null,
          items: {
            deleteMany: {},
            create: validItems.map((it) => ({
              itemName: it.itemName.trim(),
              productId: it.productId || null,
              priceType: it.priceType || null,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              total: Number(it.quantity) * Number(it.unitPrice),
            })),
          },
        },
        include: { items: true },
      })

      // 4. تطبيق المخزون الجديد
      for (const it of validItems) {
        if (!it.productId) continue
        await tx.product.updateMany({
          where: { id: it.productId, companyId: auth.companyId },
          data: { quantity: { decrement: Number(it.quantity) } },
        })
      }

      // 5. حركة الخزينة الجديدة
      if (paidAmount > 0) {
        await tx.treasuryTransaction.create({
          data: {
            type: 'deposit',
            amount: paidAmount,
            date: new Date(date),
            description: `تحصيل فاتورة مبيعات ${updated.invoiceNo || ''}`.trim(),
            category: 'مبيعات',
            referenceType: 'sale',
            referenceId: updated.id,
            companyId: auth.companyId!,
          },
        })
      }

      return updated
    })

    return NextResponse.json({ sale: updatedSale })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// DELETE /api/sales/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const sale = await db.sale.findFirst({
      where: { id, companyId: auth.companyId },
      include: { items: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    // حذف الفاتورة يعكس أثرها على المخزون والخزينة
    await db.$transaction(async (tx) => {
      for (const item of sale.items) {
        if (!item.productId) continue
        await tx.product.updateMany({
          where: { id: item.productId, companyId: auth.companyId },
          data: { quantity: { increment: item.quantity } },
        })
      }
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'sale', referenceId: sale.id, companyId: auth.companyId },
      })
      await tx.sale.delete({ where: { id: sale.id } })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
