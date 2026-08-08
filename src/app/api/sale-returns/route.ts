import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const companyId = scope.companyId

    const { searchParams } = new URL(req.url)
    const saleId = searchParams.get('saleId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = { companyId }
    if (saleId) where.saleId = saleId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); where.date.lte = d }
    }

    const [returns, total] = await Promise.all([
      db.saleReturn.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.saleReturn.count({ where }),
    ])
    // المفتاح saleReturns كما يتوقع العميل (contract fix)
    return NextResponse.json({ saleReturns: returns, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const companyId = scope.companyId

    const body = await req.json()
    const { saleId, date, reason, notes, items, returnNumber, customerName, restockItems } = body

    if (!saleId || !date) {
      return NextResponse.json({ error: 'بيانات المرتجع غير مكتملة' }, { status: 400 })
    }

    const itemsArr = Array.isArray(items) ? items : []
    // حساب الإجمالي من الأصناف إذا لم يُرسل total (العميل يرسل الأصناف فقط)
    const computedTotal = itemsArr.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
    const total = body.total !== undefined && body.total !== null ? Number(body.total) : computedTotal
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: 'إجمالي المرتجع يجب أن يكون أكبر من صفر' }, { status: 400 })
    }

    // إنشاء رقم المرتجع
    const retNum = returnNumber || `RET-${Date.now()}`
    const shouldRestock = restockItems !== false

    const ret = await db.$transaction(async (tx: any) => {
      // Fix IDOR: البحث عن الفاتورة مقيد بالشركة
      const sale = await tx.sale.findFirst({ where: { id: saleId, companyId }, include: { items: true } })
      if (!sale) throw new Error('الفاتورة غير موجودة')

      // المرتجعات السابقة لنفس الفاتورة — للتحقق التراكمي (مجموع المرتجعات ≤ الأصل)
      const previousReturns = await tx.saleReturn.findMany({
        where: { saleId, companyId },
        select: { total: true, items: true },
      })

      // Validate return total does not exceed what was paid or the invoice total (تراكمياً)
      const maxReturnable = Math.min(sale.total, sale.paid)
      const alreadyReturnedTotal = previousReturns.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0)
      if (alreadyReturnedTotal + total > maxReturnable) {
        throw new Error(`مبلغ المرتجع (${total}) يتجاوز الحد المسموح (${Math.max(0, maxReturnable - alreadyReturnedTotal)})`)
      }

      // تحقق كميات الأصناف: مجموع المرتجعات السابقة + الجديدة ≤ كمية الفاتورة لكل صنف
      const returnedQtyByItem = new Map<string, number>()
      for (const r of previousReturns) {
        const rItems = Array.isArray(r.items) ? (r.items as any[]) : []
        for (const ri of rItems) {
          if (ri?.saleItemId && Number(ri.quantity) > 0) {
            returnedQtyByItem.set(ri.saleItemId, (returnedQtyByItem.get(ri.saleItemId) || 0) + Number(ri.quantity))
          }
        }
      }
      for (const it of itemsArr) {
        const qty = Number(it.quantity) || 0
        if (qty <= 0) throw new Error(`كمية المرتجع غير صالحة للصنف: ${it.itemName || ''}`)
        if (it.saleItemId) {
          const saleItem = sale.items.find((si: any) => si.id === it.saleItemId)
          if (!saleItem) throw new Error(`الصنف (${it.itemName || it.saleItemId}) لا ينتمي لهذه الفاتورة`)
          const alreadyQty = returnedQtyByItem.get(it.saleItemId) || 0
          if (alreadyQty + qty > saleItem.quantity) {
            throw new Error(`كمية المرتجع للصنف (${saleItem.itemName}) تتجاوز المتبقي من الفاتورة (${Math.max(0, saleItem.quantity - alreadyQty)})`)
          }
        }
      }

      const cName = customerName || sale.customerName || ''

      const saleReturn = await tx.saleReturn.create({
        data: {
          companyId,
          returnNumber: retNum,
          saleId,
          invoiceNo: sale.invoiceNo,
          customerName: cName,
          customerId_ref: sale.customerId_ref,
          date: new Date(date),
          total,
          items: itemsArr,
          reason: reason?.trim() || null,
          notes: notes?.trim() || null,
          restockItems: shouldRestock,
        },
      })

      if (shouldRestock) {
        for (const item of itemsArr) {
          if (item.productId && Number(item.quantity) > 0) {
            // Atomic increment — مقيد بالشركة
            const updated = await tx.product.updateMany({
              where: { id: item.productId, companyId },
              data: { quantity: { increment: Number(item.quantity) } },
            })
            if (updated.count === 0) throw new Error('المنتج غير موجود')
          }
        }
      }

      await tx.treasuryTransaction.create({
        data: {
          companyId,
          type: 'withdrawal', amount: total, date: new Date(date),
          description: `مرتجع مبيعات - ${sale.customerName}`,
          category: 'مرتجعات', referenceType: 'sale_return', referenceId: saleReturn.id,
        },
      })

      return saleReturn
    })

    // المفتاح saleReturn كما يتوقع العميل (contract fix)
    return NextResponse.json({ saleReturn: ret })
  } catch (e) {
    if (e instanceof Error && e.message.includes('غير موجود')) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    if (e instanceof Error && (e.message.includes('يتجاوز الحد المسموح') || e.message.includes('تتجاوز المتبقي') || e.message.includes('لا ينتمي') || e.message.includes('غير صالحة'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
