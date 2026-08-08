import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'
import { requireAdmin } from '@/lib/admin-check'
import { computeInvoiceTotals, assertValidPaid } from '@/lib/calc'

// GET /api/sales/[id] — جلب فاتورة بيع واحدة (معزولة بالشركة)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params

    // findFirst بدلاً من findUnique لضمان تبعية الفاتورة للشركة الحالية (حماية IDOR)
    const sale = await db.sale.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }
    return NextResponse.json({ sale })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

// حساب الكميات المُرتجعة سابقاً لكل منتج من مرتجعات الفاتورة (restockItems=true)
// items مخزنة كـ JSON في SaleReturn — كل عنصر: { itemName, productId?, saleItemId?, quantity, unitPrice }
// المفتاح productId لأن إعادة التخزين عند المرتجع تتم بالمنتج (نفس نمط getReturnedQtyByMaterial في المشتريات)
async function getReturnedQtyByProduct(tx: any, saleId: string, companyId: string | null) {
  const returnedQty = new Map<string, number>()
  const returns = await tx.saleReturn.findMany({
    where: { saleId, companyId, restockItems: true },
    select: { items: true },
  })
  for (const r of returns) {
    const rItems = Array.isArray(r.items) ? (r.items as any[]) : []
    for (const ri of rItems) {
      if (ri?.productId && Number(ri.quantity) > 0) {
        returnedQty.set(ri.productId, (returnedQty.get(ri.productId) || 0) + Number(ri.quantity))
      }
    }
  }
  return returnedQty
}

// PUT /api/sales/[id]
// وضعان:
//  1) تعديل كامل للفاتورة (عند إرسال items): العميل/رقم الفاتورة/التاريخ/الملاحظات/المدفوع/الأصناف/الخصم/الضريبة/المصاريف
//     مع عكس مخزون الأصناف القديمة وخصم مخزون الجديدة وإعادة حساب الإجماليات في السيرفر — كل ذلك ذرّياً.
//     ملاحظة: يُمنع التعديل الكامل على فاتورة عليها مرتجعات (المرتجعات تشير لأصناف قد تُحذف،
//     ولأن المرتجعات أعادت كمياتها للمخزون فالعكس الكامل سيضخّم المخزون) — احذف المرتجعات أولاً.
//  2) تحديث المدفوع/الملاحظات فقط (استلام دفعة) — السلوك السابق كما هو ويعمل دائماً.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params
    const body = await req.json()

    // ===== الوضع 1: تعديل كامل للفاتورة (items موجودة) =====
    if (Array.isArray(body.items)) {
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
      if (items.length === 0) {
        return NextResponse.json({ error: 'يجب إضافة صنف واحداً على الأقل' }, { status: 400 })
      }

      const validItems = items.filter(
        (it: any) => it.itemName?.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0
      )
      if (validItems.length === 0) {
        return NextResponse.json({ error: 'أضف صنفاً صحيحاً واحداً على الأقل' }, { status: 400 })
      }

      // منع القيم السالبة للخصم/الضريبة/المصاريف (نفس تحققات POST)
      if (Number(discountValue) < 0 || Number(taxRate) < 0 || Number(extraFees) < 0) {
        return NextResponse.json({ error: 'قيم الخصم والضريبة والمصاريف لا يمكن أن تكون سالبة' }, { status: 400 })
      }

      // إعادة حساب الإجماليات في السيرفر (لا يثق بحسابات العميل)
      const totals = computeInvoiceTotals({ items: validItems, discountType, discountValue, taxRate, extraFees })
      const { subtotal, discountAmount, taxAmount, total } = totals
      const discType = totals.discountType
      const discValue = totals.discountValue
      const tRate = totals.taxRate
      const fees = totals.extraFees
      const paidAmount = Number(paid) || 0

      if (discountAmount > subtotal) {
        return NextResponse.json({ error: 'مبلغ الخصم لا يمكن أن يتجاوز الإجمالي الفرعي' }, { status: 400 })
      }
      if (discType === 'percentage' && discValue > 100) {
        return NextResponse.json({ error: 'نسبة الخصم لا يمكن أن تتجاوز 100%' }, { status: 400 })
      }
      const paidError = assertValidPaid(paidAmount, total)
      if (paidError) {
        return NextResponse.json({ error: paidError }, { status: 400 })
      }

      const sale = await db.$transaction(async (tx) => {
        // 1) جلب الفاتورة الحالية بعناصرها — داخل الشركة فقط (حماية IDOR)
        const existing = await tx.sale.findFirst({
          where: { id, companyId },
          include: { items: true },
        })
        if (!existing) {
          throw new Error('__NOT_FOUND__')
        }

        // منع التعديل الكامل على فاتورة عليها مرتجعات — المرتجعات أعادت كمياتها للمخزون
        // وستبقى تشير لأصناف لم تعد موجودة بعد التعديل؛ احذف المرتجعات أولاً (الأبسط والأكثر أماناً)
        const returnsCount = await tx.saleReturn.count({
          where: { saleId: id, companyId },
        })
        if (returnsCount > 0) {
          throw new Error('__HAS_RETURNS__')
        }

        // 2) عكس مخزون الأصناف القديمة: إرجاع الكميات للمنتجات ذرّياً
        //    (بعد المنع أعلاه لا توجد مرتجعات، فالصافي = كامل كمية الفاتورة)
        for (const item of existing.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: item.quantity }, updatedAt: new Date() },
            })
          }
        }

        // 3) فحص مخزون الأصناف الجديدة بعد العكس (نفس نمط POST)
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

        // التحقق من العميل — مع عزل الشركة
        if (customerId_ref) {
          const customer = await tx.customer.findFirst({
            where: { id: customerId_ref, companyId },
          })
          if (!customer) {
            throw new Error('العميل المحدد غير موجود')
          }
        }

        // حذف العناصر القديمة ثم تحديث الفاتورة وإنشاء العناصر الجديدة
        await tx.saleItem.deleteMany({ where: { saleId: id } })

        const updated = await tx.sale.update({
          where: { id },
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
            updatedAt: new Date(),
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

        // خصم مخزون الأصناف الجديدة
        for (const it of validItems) {
          if (it.productId) {
            await tx.product.update({
              where: { id: it.productId },
              data: { quantity: { decrement: Number(it.quantity) }, updatedAt: new Date() },
            })
          }
        }

        // 5) مزامنة الخزينة بفرق المدفوع (المنطق الحديث محفوظ)
        const paidDelta = paidAmount - existing.paid
        if (paidDelta !== 0) {
          await tx.treasuryTransaction.create({
            data: {
              companyId,
              type: paidDelta > 0 ? 'deposit' : 'withdrawal',
              amount: Math.abs(paidDelta),
              date: new Date(),
              description: paidDelta > 0
                ? `تحصيل دفعة مبيعات - ${existing.customerName}`
                : `تسوية (تخفيض) المدفوع على فاتورة مبيعات - ${existing.customerName}`,
              category: 'مبيعات',
              referenceType: 'sale',
              referenceId: id,
              notes: (invoiceNo?.trim() || existing.invoiceNo)
                ? `فاتورة رقم ${invoiceNo?.trim() || existing.invoiceNo}`
                : null,
            },
          })
        }

        return updated
      })

      return NextResponse.json({ sale })
    }

    // ===== الوضع 2: تحديث المدفوع/الملاحظات فقط (السلوك السابق) =====

    // التحقق من وجود الفاتورة داخل نفس الشركة (حماية IDOR)
    const existing = await db.sale.findFirst({ where: { id, companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    const data: any = { updatedAt: new Date() }
    let paidDelta = 0

    // تحديث المدفوع مع منع paid > total والقيم السالبة
    if (body.paid !== undefined) {
      const paidAmount = Number(body.paid)
      if (isNaN(paidAmount)) {
        return NextResponse.json({ error: 'المبلغ المدفوع غير صالح' }, { status: 400 })
      }
      const paidError = assertValidPaid(paidAmount, existing.total)
      if (paidError) {
        return NextResponse.json({ error: paidError }, { status: 400 })
      }
      data.paid = paidAmount
      paidDelta = paidAmount - existing.paid
    }

    if (body.notes !== undefined) {
      data.notes = body.notes?.trim?.() || null
    }

    // تحديث الفاتورة + مزامنة الخزينة ذرّياً: أي زيادة في المدفوع = إيداع، وأي نقص = سحب
    const sale = await db.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data,
        include: { items: true },
      })

      if (paidDelta !== 0) {
        await tx.treasuryTransaction.create({
          data: {
            companyId,
            type: paidDelta > 0 ? 'deposit' : 'withdrawal',
            amount: Math.abs(paidDelta),
            date: new Date(),
            description: paidDelta > 0
              ? `تحصيل دفعة مبيعات - ${existing.customerName}`
              : `تسوية (تخفيض) المدفوع على فاتورة مبيعات - ${existing.customerName}`,
            category: 'مبيعات',
            referenceType: 'sale',
            referenceId: id,
            notes: existing.invoiceNo ? `فاتورة رقم ${existing.invoiceNo}` : null,
          },
        })
      }

      return updated
    })
    return NextResponse.json({ sale })
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === '__NOT_FOUND__') {
        return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
      }
      if (e.message === '__HAS_RETURNS__') {
        return NextResponse.json(
          { error: 'لا يمكن تعديل أصناف فاتورة عليها مرتجعات — احذف المرتجعات أولاً' },
          { status: 400 }
        )
      }
      if (e.message.includes('المنتج') || e.message.includes('الكمية') || e.message.includes('العميل')) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
    }
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId
    const { id } = await params

    // جلب الفاتورة مع أصنافها — داخل الشركة فقط
    const sale = await db.sale.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // 1) إرجاع كميات المنتجات للمخزون — صافي الكمية فقط
      //    إصلاح التضخيم المزدوج: المرتجعات (restockItems=true) سبق أن أعادت كمياتها للمخزون،
      //    لذا نعيد فقط صافي الكمية = max(0, كمية الفاتورة − الكميات المُرتجعة سابقاً لنفس المنتج)
      const returnedQty = await getReturnedQtyByProduct(tx, id, companyId)
      for (const item of sale.items) {
        if (item.productId) {
          const netQty = Math.max(0, item.quantity - (returnedQty.get(item.productId) || 0))
          if (netQty > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: netQty }, updatedAt: new Date() },
            })
          }
        }
      }

      // 2) حذف حركة الخزينة المرتبطة (إيداع المبيعات) — داخل الشركة فقط
      if (sale.paid > 0) {
        await tx.treasuryTransaction.deleteMany({
          where: { referenceType: 'sale', referenceId: id, companyId },
        })
      }

      // 3) حذف المدفوعات المرتبطة بالفاتورة + حركات الخزينة الخاصة بها (referenceType: payment)
      //    ذرّياً داخل نفس الـ transaction حتى لا تبقى دفعات يتيمة تُبالغ في ذمم العملاء
      const salePayments = await tx.payment.findMany({
        where: { invoiceId: id, companyId },
        select: { id: true },
      })
      if (salePayments.length > 0) {
        await tx.treasuryTransaction.deleteMany({
          where: { referenceType: 'payment', referenceId: { in: salePayments.map((p) => p.id) }, companyId },
        })
      }
      await tx.payment.deleteMany({
        where: { invoiceId: id, companyId },
      })

      // 4) حذف المرتجعات المرتبطة
      const returnIds = await tx.saleReturn.findMany({
        where: { saleId: id, companyId },
        select: { id: true },
      })
      if (returnIds.length > 0) {
        const ids = returnIds.map(r => r.id)
        // حذف حركات الخزينة للمرتجعات
        await tx.treasuryTransaction.deleteMany({
          where: { referenceType: 'sale_return', referenceId: { in: ids }, companyId },
        })
        await tx.saleReturn.deleteMany({ where: { id: { in: ids } } })
      }

      // 5) حذف أصناف الفاتورة ثم الفاتورة نفسها
      await tx.saleItem.deleteMany({ where: { saleId: id } })
      await tx.sale.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
