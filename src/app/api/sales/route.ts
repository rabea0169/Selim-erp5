import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'
import { computeInvoiceTotals } from '@/lib/invoice-totals'

interface SaleItem {
  itemName: string
  productId?: string | null
  priceType?: string | null
  quantity: number
  unitPrice: number
}

interface SaleBody {
  customerName?: string
  customerId_ref?: string | null
  invoiceNo?: string | null
  date?: string
  items?: SaleItem[]
  paid?: number
  notes?: string | null
  discountType?: 'percentage' | 'fixed' | 'none' | null
  discountValue?: number | null
  taxRate?: number | null
  extraFees?: number | null
}

// GET /api/sales?from=&to=&q=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q') || ''

    const where: Record<string, unknown> = withCompanyScope({}, auth.companyId!)
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        dateFilter.lte = toDate
      }
      where.date = dateFilter
    }
    if (q) {
      where.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { invoiceNo: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ]
    }

    const sales = await db.sale.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ sales })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// POST /api/sales
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body: SaleBody = await req.json()
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

    const validItems = items.filter(
      (it) => it.itemName?.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0
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

    const sale = await db.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
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
          companyId: auth.companyId!,
          items: {
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

      // خصم المباع من رصيد المنتج
      for (const it of validItems) {
        if (!it.productId) continue
        await tx.product.updateMany({
          where: { id: it.productId, companyId: auth.companyId },
          data: { quantity: { decrement: Number(it.quantity) } },
        })
      }

      // المحصل نقداً يدخل الخزينة
      if (paidAmount > 0) {
        await tx.treasuryTransaction.create({
          data: {
            type: 'deposit',
            amount: paidAmount,
            date: new Date(date),
            description: `تحصيل فاتورة مبيعات ${newSale.invoiceNo || ''}`.trim(),
            category: 'مبيعات',
            referenceType: 'sale',
            referenceId: newSale.id,
            companyId: auth.companyId!,
          },
        })
      }

      return newSale
    })

    return NextResponse.json({ sale })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
