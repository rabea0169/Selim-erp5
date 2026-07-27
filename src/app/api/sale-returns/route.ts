import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/sale-returns?saleId=&from=&to=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const saleId = searchParams.get('saleId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = {}
    if (saleId) where.saleId = saleId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const d = new Date(to)
        d.setHours(23, 59, 59, 999)
        where.date.lte = d
      }
    }

    const [returns, total] = await Promise.all([
      db.saleReturn.findMany({
        where,
        include: { sale: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.saleReturn.count({ where }),
    ])

    return NextResponse.json({
      returns,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/sale-returns
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { saleId, invoiceNo, customerName, customerId_ref, date, total, reason, restockItems, items, notes } = body

    if (!saleId || !customerName || !date) {
      return NextResponse.json({ error: 'بيانات مطلوبة ناقصة' }, { status: 400 })
    }

    const saleReturn = await db.$transaction(async (tx) => {
      const ret = await tx.saleReturn.create({
        data: {
          returnNumber: `SR-${Date.now()}`,
          saleId,
          invoiceNo: invoiceNo?.trim() || null,
          customerName: customerName.trim(),
          customerId_ref: customerId_ref || null,
          date: new Date(date),
          total: Number(total) || 0,
          reason: reason?.trim() || null,
          restockItems: restockItems !== false,
          items: items || [],
          notes: notes?.trim() || null,
        },
        include: { sale: true },
      })

      // Restock products if requested
      if (ret.restockItems && Array.isArray(items)) {
        for (const it of items) {
          if (it.productId) {
            await tx.product.update({
              where: { id: it.productId },
              data: { quantity: { increment: Number(it.quantity) || 0 } },
            })
          }
        }
      }

      // Treasury transaction (withdrawal - money returned to customer)
      if (ret.total > 0) {
        await tx.treasuryTransaction.create({
          data: {
            type: 'withdrawal',
            amount: ret.total,
            date: new Date(date),
            description: `مرتجع مبيعات - ${customerName}`,
            category: 'مرتجعات مبيعات',
            referenceType: 'sale_return',
            referenceId: ret.id,
            notes: invoiceNo ? `فاتورة رقم ${invoiceNo}` : null,
          },
        })
      }

      return ret
    })

    return NextResponse.json({ return: saleReturn })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
