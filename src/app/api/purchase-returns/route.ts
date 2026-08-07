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

    // المفتاح purchaseReturns كما يتوقع العميل (contract fix)
    return NextResponse.json({ purchaseReturns: returns, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
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
    const { purchaseId, invoiceNo, supplierName, supplierId_ref, date, reason, restockItems, items, notes } = body

    if (!purchaseId || !date) {
      return NextResponse.json({ error: 'بيانات مطلوبة ناقصة' }, { status: 400 })
    }

    const itemsArr = Array.isArray(items) ? items : []
    // حساب الإجمالي من الأصناف إذا لم يُرسل total (العميل يرسل الأصناف فقط)
    const computedTotal = itemsArr.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
    const total = body.total !== undefined && body.total !== null ? Number(body.total) : computedTotal
    if (!Number.isFinite(total) || total < 0) {
      return NextResponse.json({ error: 'إجمالي المرتجع غير صالح' }, { status: 400 })
    }

    const shouldRestock = restockItems !== false

    const purchaseReturn = await db.$transaction(async (tx) => {
      // Fix IDOR: البحث عن فاتورة الشراء مقيد بالشركة
      const purchase = await tx.purchase.findFirst({ where: { id: purchaseId, companyId } })
      if (!purchase) throw new Error('فاتورة الشراء غير موجودة')

      // Validate return total does not exceed purchase total
      if (total > purchase.total) {
        throw new Error(`مبلغ المرتجع (${total}) يتجاوز إجمالي فاتورة الشراء (${purchase.total})`)
      }

      // اشتقاق بيانات المورد من الفاتورة (العميل لا يرسلها)
      const sName = supplierName?.trim() || purchase.supplierName
      const invNo = invoiceNo?.trim() || purchase.invoiceNo
      const sRef = supplierId_ref || purchase.supplierId_ref

      const ret = await tx.purchaseReturn.create({
        data: {
          companyId,
          returnNumber: `PR-${Date.now()}`,
          purchaseId,
          invoiceNo: invNo || null,
          supplierName: sName,
          supplierId_ref: sRef || null,
          date: new Date(date),
          total,
          reason: reason?.trim() || null,
          items: itemsArr,
          notes: notes?.trim() || null,
          restockItems: shouldRestock,
        },
      })

      if (shouldRestock && itemsArr.length > 0) {
        // Validate material quantities won't go negative before decrementing — مقيد بالشركة
        for (const it of itemsArr) {
          if (it.materialId && Number(it.quantity) > 0) {
            const mat = await tx.material.findFirst({ where: { id: it.materialId, companyId } })
            if (!mat) throw new Error(`المادة غير موجودة: ${it.materialId}`)
            if (mat.quantity < Number(it.quantity)) {
              throw new Error(`كمية المرتجع (${Number(it.quantity)}) تتجاوز المخزون المتاح (${mat.quantity}) للمادة: ${mat.name || it.materialId}`)
            }
          }
        }
        for (const it of itemsArr) {
          if (it.materialId && Number(it.quantity) > 0) {
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
            description: `مرتجع مشتريات - ${sName}`,
            category: 'مرتجعات مشتريات',
            referenceType: 'purchase_return',
            referenceId: ret.id,
            notes: invNo ? `فاتورة رقم ${invNo}` : null,
          },
        })
      }

      return ret
    })

    // المفتاح purchaseReturn كما يتوقع العميل (contract fix)
    return NextResponse.json({ purchaseReturn })
  } catch (e) {
    if (e instanceof Error && e.message.includes('غير موجود')) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    if (e instanceof Error && (e.message.includes('يتجاوز') || e.message.includes('تتجاوز'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
