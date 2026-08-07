import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const companyId = user.companyId ?? null

    const { searchParams } = new URL(req.url)
    const purchaseId = searchParams.get('purchaseId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = { companyId }
    if (purchaseId) where.purchaseId = purchaseId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); where.date.lte = d }
    }

    const [returns, total] = await Promise.all([
      db.purchaseReturn.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.purchaseReturn.count({ where }),
    ])

    return NextResponse.json({ returns, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const companyId = user.companyId ?? null

    const body = await req.json()
    const { purchaseId, invoiceNo, supplierName, supplierId_ref, date, total, reason, restockItems, items, notes } = body

    if (!purchaseId || !supplierName || !date) {
      return NextResponse.json({ error: 'بيانات مطلوبة ناقصة' }, { status: 400 })
    }

    const purchaseReturn = await db.$transaction(async (tx) => {
      // Fix IDOR: البحث عن فاتورة الشراء مقيد بالشركة
      const purchase = await tx.purchase.findFirst({ where: { id: purchaseId, companyId } })
      if (!purchase) throw new Error('فاتورة الشراء غير موجودة')

      // Validate return total does not exceed purchase total
      if (Number(total) > purchase.total) {
        throw new Error(`مبلغ المرتجع (${Number(total)}) يتجاوز إجمالي فاتورة الشراء (${purchase.total})`)
      }

      const ret = await tx.purchaseReturn.create({
        data: {
          companyId,
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
      })

      if (restockItems !== false && Array.isArray(items)) {
        // Validate material quantities won't go negative before decrementing — مقيد بالشركة
        for (const it of items) {
          if (it.materialId && it.quantity > 0) {
            const mat = await tx.material.findFirst({ where: { id: it.materialId, companyId } })
            if (!mat) throw new Error(`المادة غير موجودة: ${it.materialId}`)
            if (mat.quantity < Number(it.quantity)) {
              throw new Error(`كمية المرتجع (${Number(it.quantity)}) تتجاوز المخزون المتاح (${mat.quantity}) للمادة: ${mat.name || it.materialId}`)
            }
          }
        }
        for (const it of items) {
          if (it.materialId && it.quantity > 0) {
            // Atomic decrement — مقيد بالشركة
            await tx.material.updateMany({
              where: { id: it.materialId, companyId },
              data: { quantity: { decrement: Number(it.quantity) }, updatedAt: new Date() },
            })
          }
        }
      }

      if (ret.total > 0) {
        await tx.treasuryTransaction.create({
          data: {
            companyId,
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
  } catch (e) {
    if (e instanceof Error && e.message.includes('غير موجود')) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
