import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'
import { computeInvoiceTotals, assertValidPaid } from '@/lib/calc'

// GET /api/sales?from=&to=&q=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q') || ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    // عزل الشركات: لا تظهر إلا مبيعات الشركة الحالية
    const where: any = { companyId }
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
        { companyId },
        {
          OR: [
            { customerName: { contains: q } },
            { invoiceNo: { contains: q } },
            { notes: { contains: q } },
          ],
        },
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
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null

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
      return NextResponse.json({ error: 'يجب إضافة صنف واحداً على الأقل' }, { status: 400 })
    }

    const validItems = items.filter(
      (it: any) => it.itemName?.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0
    )
    if (validItems.length === 0) {
      return NextResponse.json({ error: 'أضف صنفاً صحيحاً واحداً على الأقل' }, { status: 400 })
    }

    // منع القيم السالبة للخصم/الضريبة/المصاريف (لا يثق بالعميل)
    if (Number(discountValue) < 0 || Number(taxRate) < 0 || Number(extraFees) < 0) {
      return NextResponse.json({ error: 'قيم الخصم والضريبة والمصاريف لا يمكن أن تكون سالبة' }, { status: 400 })
    }

    // حساب الإجماليات عبر المكتبة المشتركة (مغطاة باختبارات وحدية)
    const totals = computeInvoiceTotals({ items: validItems, discountType, discountValue, taxRate, extraFees })
    const { subtotal, discountAmount, taxAmount, total } = totals
    const discType = totals.discountType
    const discValue = totals.discountValue
    const tRate = totals.taxRate
    const fees = totals.extraFees
    const paidAmount = Number(paid) || 0

    // منع خصم أكبر من الإجمالي الفرعي (العميل يحدّه، والخادم يرفضه صراحة)
    if (discountAmount > subtotal) {
      return NextResponse.json({ error: 'مبلغ الخصم لا يمكن أن يتجاوز الإجمالي الفرعي' }, { status: 400 })
    }
    if (discType === 'percentage' && discValue > 100) {
      return NextResponse.json({ error: 'نسبة الخصم لا يمكن أن تتجاوز 100%' }, { status: 400 })
    }

    // F5-02 fix: التحقق من أن المدفوع لا يتجاوز الإجمالي ولا يكون سالباً
    const paidError = assertValidPaid(paidAmount, total)
    if (paidError) {
      return NextResponse.json({ error: paidError }, { status: 400 })
    }

    const sale = await db.$transaction(async (tx) => {
      // فحص المخزون داخل الـ transaction (TOCTOU fix) — مع عزل الشركة
      for (const it of validItems) {
        if (it.productId) {
          const product = await tx.product.findFirst({
            where: { id: it.productId, companyId },
          })
          if (!product) {
            throw new Error(`المنتج "${it.itemName}" غير موجود في قاعدة البيانات`)
          }
          if (product.quantity < Number(it.quantity)) {
            throw new Error(`الكمية المتاحة من ${product.name} (${product.quantity}) أقل من المطلوب (${it.quantity})`)
          }
        }
      }

      // التحقق من العميل داخل الـ transaction — مع عزل الشركة
      if (customerId_ref) {
        const customer = await tx.customer.findFirst({
          where: { id: customerId_ref, companyId },
        })
        if (!customer) {
          throw new Error('العميل المحدد غير موجود')
        }
      }

      const newSale = await tx.sale.create({
        data: {
          companyId,
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

      // إنشاء حركة خزينة — مرتبطة بنفس الشركة
      if (paidAmount > 0) {
        await tx.treasuryTransaction.create({
          data: {
            companyId,
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
