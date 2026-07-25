import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'
import { computeInvoiceTotals } from '@/lib/invoice-totals'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q') || ''

    const where: any = withCompanyScope({}, auth.companyId)
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }
    if (q) {
      where.OR = [
        { supplierName: { contains: q, mode: 'insensitive' } },
        { invoiceNo: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ]
    }

    const purchases = await db.purchase.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ purchases })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const {
      supplierName,
      supplierId_ref,
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

    if (!supplierName?.trim()) {
      return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'يجب إضافة صنف واحد على الأقل' }, { status: 400 })
    }

    const validItems = items.filter(
      (it: any) => it.itemName?.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0
    )
    if (validItems.length === 0) {
      return NextResponse.json({ error: 'أضف صنفاً صحيحاً واحداً على الأقل' }, { status: 400 })
    }

    const subtotal = validItems.reduce(
      (sum: number, it: any) => sum + Number(it.quantity) * Number(it.unitPrice),
      0
    )
    const totals = computeInvoiceTotals({ subtotal, discountType, discountValue, taxRate, extraFees })
    const paidAmount = Number(paid) || 0

    if (supplierId_ref) {
      const supplier = await db.supplier.findFirst({
        where: { id: supplierId_ref, companyId: auth.companyId },
      })
      if (!supplier) {
        return NextResponse.json({ error: 'المورد المحدد غير موجود' }, { status: 400 })
      }
    }

    const purchase = await db.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          supplierName: supplierName.trim(),
          supplierId_ref: supplierId_ref || null,
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
          companyId: auth.companyId,
          items: {
            create: validItems.map((it: any) => ({
              itemName: it.itemName.trim(),
              materialId: it.materialId || null,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              total: Number(it.quantity) * Number(it.unitPrice),
            })),
          },
        },
        include: { items: true },
      })

      // المشترى يزيد رصيد الخامة
      for (const it of validItems) {
        if (!it.materialId) continue
        await tx.material.updateMany({
          where: { id: it.materialId, companyId: auth.companyId },
          data: { quantity: { increment: Number(it.quantity) } },
        })
      }

      // المدفوع نقداً يخرج من الخزينة
      if (paidAmount > 0) {
        await tx.treasuryTransaction.create({
          data: {
            type: 'withdrawal',
            amount: paidAmount,
            date: new Date(date),
            description: `سداد فاتورة مشتريات ${newPurchase.invoiceNo || ''}`.trim(),
            category: 'مشتريات',
            referenceType: 'purchase',
            referenceId: newPurchase.id,
            companyId: auth.companyId,
          },
        })
      }

      return newPurchase
    })

    return NextResponse.json({ purchase })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
