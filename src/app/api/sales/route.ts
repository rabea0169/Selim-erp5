import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

// GET /api/sales?from=&to=&q=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q') || ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = {}
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
      where.OR = [
        { customerName: { contains: q } },
        { invoiceNo: { contains: q } },
        { notes: { contains: q } },
      ]
    }

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        include: { items: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.sale.count({ where }),
    ])

    return NextResponse.json({
      sales,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

// POST /api/sales
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
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

    const subtotal = validItems.reduce(
      (sum: number, it: any) => sum + Number(it.quantity) * Number(it.unitPrice),
      0
    )
    const discType = discountType || null
    const discValue = Number(discountValue) || 0
    const discountAmount = discType === 'percentage'
      ? subtotal * (discValue / 100)
      : discValue
    const tRate = Number(taxRate) || 0
    const taxAmount = (subtotal - discountAmount) * (tRate / 100)
    const fees = Number(extraFees) || 0
    const total = subtotal - discountAmount + taxAmount + fees
    const paidAmount = Number(paid) || 0

    // F5-02 fix: التحقق من أن المدفوع لا يتجاوز الإجمالي ولا يكون سالباً
    if (paidAmount < 0) {
      return NextResponse.json({ error: 'المبلغ المدفوع لا يمكن أن يكون سالباً' }, { status: 400 })
    }
    if (paidAmount > total) {
      return NextResponse.json({ error: `المبلغ المدفوع (${paidAmount}) يتجاوز إجمالي الفاتورة (${total})` }, { status: 400 })
    }

    const sale = await db.$transaction(async (tx) => {
      // فحص المخزون داخل الـ transaction (TOCTOU fix)
      for (const it of validItems) {
        if (it.productId) {
          const product = await tx.product.findUnique({ where: { id: it.productId } })
          if (!product) {
            throw new Error(`المنتج "${it.itemName}" غير موجود في قاعدة البيانات`)
          }
          if (product.quantity < Number(it.quantity)) {
            throw new Error(`الكمية المتاحة من ${product.name} (${product.quantity}) أقل من المطلوب (${it.quantity})`)
          }
        }
      }

      // التحقق من العميل داخل الـ transaction
      if (customerId_ref) {
        const customer = await tx.customer.findUnique({ where: { id: customerId_ref } })
        if (!customer) {
          throw new Error('العميل المحدد غير موجود')
        }
      }

      const newSale = await tx.sale.create({
        data: {
          customerName: customerName.trim(),
          customerId_ref: customerId_ref || null,
          invoiceNo: invoiceNo?.trim() || null,
          date: dateObj,
          subtotal,
          discountType: discType,
          discountValue: discValue,
          discountAmount,
          taxRate: tRate,
          taxAmount,
          extraFees: fees,
          total,
          paid: paidAmount,
          notes: notes?.trim() || null,
          items: {
            create: validItems.map((it: any) => ({
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

      // خصم الكميات من مخزون المنتجات
      for (const it of validItems) {
        if (it.productId) {
          await tx.product.update({
            where: { id: it.productId },
            data: { quantity: { decrement: Number(it.quantity) }, updatedAt: new Date() },
          })
        }
      }

      // إنشاء حركة خزينة
      if (paidAmount > 0) {
        await tx.treasuryTransaction.create({
          data: {
            type: 'deposit',
            amount: paidAmount,
            date: dateObj,
            description: `مبيعات - ${customerName.trim()}`,
            category: 'مبيعات',
            referenceType: 'sale',
            referenceId: newSale.id,
            notes: invoiceNo ? `فاتورة رقم ${invoiceNo.trim()}` : null,
          },
        })
      }

      return newSale
    })

    return NextResponse.json({ sale })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('المنتج') || e.message.includes('الكمية') || e.message.includes('العميل'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
