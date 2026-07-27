import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/purchase-returns?purchaseId=&from=&to=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const purchaseId = searchParams.get('purchaseId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = {}
    if (purchaseId) where.purchaseId = purchaseId
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
      db.purchaseReturn.findMany({
        where,
        include: { purchase: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.purchaseReturn.count({ where }),
    ])

    return NextResponse.json({
      returns,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/purchase-returns
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { purchaseId, invoiceNo, supplierName, supplierId_ref, date, total, reason, restockItems, items, notes } = body

    if (!purchaseId || !supplierName || !date) {
      return NextResponse.json({ error: 'بيانات مطلوبة ناقصة' }, { status: 400 })
    }

    const purchaseReturn = await db.$transaction(async (tx) => {
      const ret = await tx.purchaseReturn.create({
        data: {
          returnNumber: `PR-${Date.now()}`,
          purchaseId,
          invoiceNo: invoiceNo?.trim() || null,
          supplierName: supplierName.trim(),
          supplierId_ref: supplierId_ref || null,
          date: new Date(date),
          total: Number(total) || 0,
          reason: reason?.trim() || null,
          items: items || [],
          notes: notes?.trim() || null,
        },
        include: { purchase: true },
      })

      // Decrement material quantities (reverse the purchase addition)
      if (restockItems !== false && Array.isArray(items)) {
        for (const it of items) {
          if (it.materialId) {
            await tx.material.update({
              where: { id: it.materialId },
              data: { quantity: { decrement: Number(it.quantity) || 0 } },
            })
          }
        }
      }

      // Treasury transaction (deposit - money coming back from supplier)
      if (ret.total > 0) {
        await tx.treasuryTransaction.create({
          data: {
            type: 'deposit',
            amount: ret.total,
            date: new Date(date),
            description: `مرتجع مشتريات - ${supplierName}`,
            category: 'مرتجعات مشتريات',
            referenceType: 'purchase_return',
            referenceId: ret.id,
            notes: invoiceNo ? `فاتورة رقم ${invoiceNo}` : null,
          },
        })
      }

      return ret
    })

    return NextResponse.json({ return: purchaseReturn })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
