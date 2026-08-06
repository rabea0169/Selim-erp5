import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/purchases?from=&to=&q=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q') || ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = {}
    if (user?.companyId) where.companyId = user.companyId

    if (from || to) {
      where.date = {}
      if (from) {
        const d = new Date(from)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'تاريخ "من" غير صالح' }, { status: 400 })
        where.date.gte = d
      }
      if (to) {
        const toDate = new Date(to)
        if (isNaN(toDate.getTime())) return NextResponse.json({ error: 'تاريخ "إلى" غير صالح' }, { status: 400 })
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }
    if (q) {
      where.AND = [
        user?.companyId ? { companyId: user.companyId } : {},
        {
          OR: [
            { supplierName: { contains: q } },
            { invoiceNo: { contains: q } },
            { notes: { contains: q } },
          ],
        },
      ]
    }

    const [purchases, total] = await Promise.all([
      db.purchase.findMany({
        where,
        include: { items: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.purchase.count({ where }),
    ])

    return NextResponse.json({
      purchases,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const companyId = user?.companyId || null

    const body = await req.json()
    const {
      supplierName,
      supplierId_ref,
      invoiceNo,
      date,
      items,
      paid,
      notes,
    } = body

    if (!supplierName?.trim()) {
      return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
    }
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'التاريخ غير صالح' }, { status: 400 })
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

    const total = validItems.reduce(
      (sum: number, it: any) => sum + Number(it.quantity) * Number(it.unitPrice),
      0
    )
    const paidAmount = Number(paid) || 0

    if (paidAmount < 0) {
      return NextResponse.json({ error: 'المبلغ المدفوع لا يمكن أن يكون سالباً' }, { status: 400 })
    }
    if (paidAmount > total) {
      return NextResponse.json({ error: `المبلغ المدفوع (${paidAmount}) يتجاوز إجمالي الفاتورة (${total})` }, { status: 400 })
    }

    const purchase = await db.$transaction(async (tx) => {
      // فحص المواد والمورد داخل الـ transaction
      for (const it of validItems) {
        if (it.materialId) {
          const material = await tx.material.findFirst({
            where: { id: it.materialId, ...(companyId ? { companyId } : {}) },
          })
          if (!material) {
            throw new Error(`المادة "${it.itemName}" غير موجودة في قاعدة البيانات`)
          }
        }
      }

      if (supplierId_ref) {
        const supplier = await tx.supplier.findFirst({
          where: { id: supplierId_ref, ...(companyId ? { companyId } : {}) },
        })
        if (!supplier) {
          throw new Error('المورد المحدد غير موجود')
        }
      }

      const newPurchase = await tx.purchase.create({
        data: {
          companyId,
          supplierName: supplierName.trim(),
          supplierId_ref: supplierId_ref || null,
          invoiceNo: invoiceNo?.trim() || null,
          date: dateObj,
          total,
          paid: paidAmount,
          notes: notes?.trim() || null,
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

      // إضافة الكميات لمخزون المواد الخام
      for (const it of validItems) {
        if (it.materialId) {
          const material = await tx.material.findUnique({ where: { id: it.materialId } })
          if (material) {
            const totalOldValue = material.quantity * material.unitCost
            const totalNewValue = Number(it.quantity) * Number(it.unitPrice)
            const newQuantity = material.quantity + Number(it.quantity)
            const newUnitCost = newQuantity > 0 ? (totalOldValue + totalNewValue) / newQuantity : Number(it.unitPrice)

            await tx.material.update({
              where: { id: it.materialId },
              data: {
                quantity: { increment: Number(it.quantity) },
                unitCost: newUnitCost,
                updatedAt: new Date(),
              },
            })

            await tx.materialTransaction.create({
              data: {
                companyId,
                materialId: it.materialId,
                warehouseId: material.warehouseId,
                type: 'in',
                quantity: Number(it.quantity),
                unitCost: Number(it.unitPrice),
                date: dateObj,
                reason: `شراء - ${supplierName.trim()}${invoiceNo ? ` (فاتورة ${invoiceNo})` : ''}`,
                referenceType: 'purchase',
                referenceId: newPurchase.id,
              },
            })
          }
        }
      }

      if (paidAmount > 0) {
        await tx.treasuryTransaction.create({
          data: {
            companyId,
            type: 'withdrawal',
            amount: paidAmount,
            date: dateObj,
            description: `مشتريات - ${supplierName.trim()}`,
            category: 'مشتريات',
            referenceType: 'purchase',
            referenceId: newPurchase.id,
            notes: invoiceNo ? `فاتورة رقم ${invoiceNo.trim()}` : null,
          },
        })
      }

      return newPurchase
    })

    return NextResponse.json({ purchase })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('المادة') || e.message.includes('المورد'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
