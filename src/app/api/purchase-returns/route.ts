import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const purchaseId = searchParams.get('purchaseId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = user.companyId ? { companyId: user.companyId } : {}
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
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })

    const companyId = user.companyId || null
    const body = await req.json()
    const { purchaseId, invoiceNo, supplierName, supplierId_ref, date, reason, restockItems, items, notes } = body

    if (!purchaseId || !date) {
      return NextResponse.json({ error: 'بيانات مطلوبة ناقصة' }, { status: 400 })
    }

    const totalNum = Math.round((Number(total) || 0) * 100) / 100

    const purchaseReturn = await db.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id: purchaseId, ...(companyId ? { companyId } : {}) },
      })
      if (!purchase) throw new Error('فاتورة الشراء غير موجودة')

      const purchaseTotal = Math.round(purchase.total * 100) / 100
      if (totalNum - purchaseTotal > 0.01) {
        throw new Error(`مبلغ المرتجع (${totalNum}) يتجاوز إجمالي فاتورة الشراء (${purchaseTotal})`)
      }

      // تحقق كميات الأصناف: مجموع المرتجعات السابقة + الجديدة ≤ كمية الفاتورة لكل صنف
      const returnedQtyByItem = new Map<string, number>()
      for (const r of previousReturns) {
        const rItems = Array.isArray(r.items) ? (r.items as any[]) : []
        for (const ri of rItems) {
          if (ri?.purchaseItemId && Number(ri.quantity) > 0) {
            returnedQtyByItem.set(ri.purchaseItemId, (returnedQtyByItem.get(ri.purchaseItemId) || 0) + Number(ri.quantity))
          }
        }
      }
      for (const it of itemsArr) {
        const qty = Number(it.quantity) || 0
        if (qty <= 0) throw new Error(`كمية المرتجع غير صالحة للصنف: ${it.itemName || ''}`)
        if (it.purchaseItemId) {
          const purchaseItem = purchase.items.find((pi: any) => pi.id === it.purchaseItemId)
          if (!purchaseItem) throw new Error(`الصنف (${it.itemName || it.purchaseItemId}) لا ينتمي لهذه الفاتورة`)
          const alreadyQty = returnedQtyByItem.get(it.purchaseItemId) || 0
          if (alreadyQty + qty > purchaseItem.quantity) {
            throw new Error(`كمية المرتجع للصنف (${purchaseItem.itemName}) تتجاوز المتبقي من الفاتورة (${Math.max(0, purchaseItem.quantity - alreadyQty)})`)
          }
        }
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
          total: totalNum,
          reason: reason?.trim() || null,
          items: itemsArr,
          notes: notes?.trim() || null,
          restockItems: shouldRestock,
        },
      })

      if (restockItems !== false && Array.isArray(items)) {
        for (const it of items) {
          if (it.materialId && it.quantity > 0) {
            const mat = await tx.material.findFirst({
              where: { id: it.materialId, ...(companyId ? { companyId } : {}) },
            })
            if (!mat) throw new Error(`المادة غير موجودة: ${it.materialId}`)
            if (mat.quantity < Number(it.quantity)) {
              throw new Error(`كمية المرتجع (${Number(it.quantity)}) تتجاوز المخزون المتاح (${mat.quantity}) للمادة: ${mat.name || it.materialId}`)
            }
          }
        }
        for (const it of items) {
          if (it.materialId && it.quantity > 0) {
            await tx.material.update({
              where: { id: it.materialId },
              data: {
                quantity: Math.max(0, remainingQuantity),
                unitCost: newUnitCost,
                updatedAt: new Date(),
              },
            })

            await tx.materialTransaction.create({
              data: {
                companyId,
                materialId: it.materialId,
                warehouseId: mat.warehouseId,
                type: 'out',
                quantity: qty,
                unitCost: price,
                date: new Date(date),
                reason: `مرتجع مشتريات - ${sName}${invNo ? ` (فاتورة ${invNo})` : ''}`,
                referenceType: 'purchase_return',
                referenceId: ret.id,
              },
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

    return NextResponse.json({ return: purchaseReturn })
  } catch (e: any) {
    const { error, status } = safeError(e, 400)
    return NextResponse.json({ error }, { status })
  }
}
