import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'

// GET /api/sale-returns?q=&from=&to=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = withCompanyScope({}, auth.companyId)
    if (q) {
      where.OR = [
        { returnNumber: { contains: q, mode: 'insensitive' } },
        { invoiceNo: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const returns = await db.saleReturn.findMany({ where, orderBy: { date: 'desc' } })
    return NextResponse.json({ returns })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// POST /api/sale-returns
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { saleId, date, reason, restockItems, items, notes, returnNumber } = body

    if (!saleId?.trim()) {
      return NextResponse.json({ error: 'الفاتورة الأصلية مطلوبة' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'يجب اختيار صنف واحد على الأقل' }, { status: 400 })
    }

    const sale = await db.sale.findFirst({
      where: { id: saleId, companyId: auth.companyId },
      include: { items: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    // لا يمكن إرجاع كمية أكبر من المباعة (مع احتساب المرتجعات السابقة)
    const previous = await db.saleReturn.findMany({ where: { saleId } })
    const alreadyReturned = new Map<string, number>()
    for (const ret of previous) {
      for (const it of (ret.items as any[]) || []) {
        alreadyReturned.set(it.saleItemId, (alreadyReturned.get(it.saleItemId) || 0) + Number(it.quantity))
      }
    }

    let total = 0
    for (const it of items) {
      const original = sale.items.find((si) => si.id === it.saleItemId)
      if (!original) {
        return NextResponse.json({ error: `الصنف ${it.itemName} غير موجود في الفاتورة` }, { status: 400 })
      }
      const qty = Number(it.quantity)
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: 'كمية المرتجع يجب أن تكون موجبة' }, { status: 400 })
      }
      const remaining = original.quantity - (alreadyReturned.get(original.id) || 0)
      if (qty > remaining) {
        return NextResponse.json(
          { error: `الكمية المتاحة للإرجاع من ${original.itemName} هي ${remaining}` },
          { status: 400 }
        )
      }
      total += qty * Number(it.unitPrice ?? original.unitPrice)
    }

    const created = await db.$transaction(async (tx) => {
      const saleReturn = await tx.saleReturn.create({
        data: {
          returnNumber: returnNumber?.trim() || `SR-${Date.now()}`,
          saleId: sale.id,
          invoiceNo: sale.invoiceNo,
          customerName: sale.customerName,
          customerId_ref: sale.customerId_ref,
          date: date ? new Date(date) : new Date(),
          total,
          reason: reason?.trim() || null,
          restockItems: restockItems !== false,
          items,
          notes: notes?.trim() || null,
          companyId: auth.companyId,
        },
      })

      if (restockItems !== false) {
        for (const it of items) {
          if (!it.productId) continue
          await tx.product.updateMany({
            where: { id: it.productId, companyId: auth.companyId },
            data: { quantity: { increment: Number(it.quantity) } },
          })
        }
      }

      return saleReturn
    })

    return NextResponse.json({ return: created })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
