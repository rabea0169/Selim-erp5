import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'

// GET /api/purchase-returns?q=&from=&to=
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
        { supplierName: { contains: q, mode: 'insensitive' } },
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

    const returns = await db.purchaseReturn.findMany({ where, orderBy: { date: 'desc' } })
    return NextResponse.json({ returns })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/purchase-returns
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { purchaseId, date, reason, items, notes, returnNumber } = body

    if (!purchaseId?.trim()) {
      return NextResponse.json({ error: 'فاتورة الشراء الأصلية مطلوبة' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'يجب اختيار صنف واحد على الأقل' }, { status: 400 })
    }

    const purchase = await db.purchase.findFirst({
      where: { id: purchaseId, companyId: auth.companyId },
      include: { items: true },
    })
    if (!purchase) {
      return NextResponse.json({ error: 'فاتورة الشراء غير موجودة' }, { status: 404 })
    }

    const previous = await db.purchaseReturn.findMany({ where: { purchaseId } })
    const alreadyReturned = new Map<string, number>()
    for (const ret of previous) {
      for (const it of (ret.items as any[]) || []) {
        alreadyReturned.set(it.purchaseItemId, (alreadyReturned.get(it.purchaseItemId) || 0) + Number(it.quantity))
      }
    }

    let total = 0
    for (const it of items) {
      const original = purchase.items.find((pi) => pi.id === it.purchaseItemId)
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
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          returnNumber: returnNumber?.trim() || `PR-${Date.now()}`,
          purchaseId: purchase.id,
          invoiceNo: purchase.invoiceNo,
          supplierName: purchase.supplierName,
          supplierId_ref: purchase.supplierId_ref,
          date: date ? new Date(date) : new Date(),
          total,
          reason: reason?.trim() || null,
          items,
          notes: notes?.trim() || null,
          companyId: auth.companyId,
        },
      })

      // المرتجع للمورد يخصم الكمية من المخزون
      for (const it of items) {
        if (!it.materialId) continue
        await tx.material.updateMany({
          where: { id: it.materialId, companyId: auth.companyId },
          data: { quantity: { decrement: Number(it.quantity) } },
        })
      }

      return purchaseReturn
    })

    return NextResponse.json({ return: created })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
