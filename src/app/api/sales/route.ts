import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/sales?from=&to=&q=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q') || ''

    const where: any = {}
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
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

    const sales = await db.sale.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ sales })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
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
    } = body

    // التحقق من البيانات المدخلة
    if (!customerName?.trim()) {
      return NextResponse.json(
        { error: 'اسم العميل مطلوب' },
        { status: 400 }
      )
    }
    if (!date) {
      return NextResponse.json(
        { error: 'التاريخ مطلوب' },
        { status: 400 }
      )
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'يجب إضافة صنف واحد على الأقل' },
        { status: 400 }
      )
    }

    // ===== التحقق من ربط الأصناف بالمنتجات =====
    const itemsWithoutProduct = items.filter((it: any) => !it.productId)
    if (itemsWithoutProduct.length > 0) {
      return NextResponse.json(
        { error: `يوجد ${itemsWithoutProduct.length} أصناف غير مربوطة بمنتج. يجب اختيار المنتج من القائمة لضمان تحديث المخزون بشكل صحيح. الصنف: ${itemsWithoutProduct[0].itemName || 'بدون اسم'}` },
        { status: 400 }
      )
    }

    // التحقق من صحة كل صنف
    const validItems = items.filter(
      (it: any) => it.itemName?.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0
    )
    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'أضف صنفاً صحيحاً واحداً على الأقل' },
        { status: 400 }
      )
    }

    // التحقق من توفر الكميات في المخزون
    for (const it of validItems) {
      if (it.productId) {
        const product = await db.product.findUnique({ where: { id: it.productId } })
        if (!product) {
          return NextResponse.json(
            { error: `المنتج "${it.itemName}" غير موجود في قاعدة البيانات` },
            { status: 400 }
          )
        }
        if (product.quantity < it.quantity) {
          return NextResponse.json(
            { error: `الكمية المتاحة من ${product.name} (${product.quantity}) أقل من المطلوب (${it.quantity})` },
            { status: 400 }
          )
        }
      }
    }

    // حساب الإجمالي
    const total = validItems.reduce(
      (sum: number, it: any) => sum + Number(it.quantity) * Number(it.unitPrice),
      0
    )
    const paidAmount = Number(paid) || 0

    // التحقق من وجود العميل لو تم تحديده
    if (customerId_ref) {
      const customer = await db.customer.findUnique({
        where: { id: customerId_ref },
      })
      if (!customer) {
        return NextResponse.json(
          { error: 'العميل المحدد غير موجود' },
          { status: 400 }
        )
      }
    }

    // إنشاء الفاتورة وأصنافها في transaction واحد
    const sale = await db.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          customerName: customerName.trim(),
          customerId_ref: customerId_ref || null,
          invoiceNo: invoiceNo?.trim() || null,
          date: new Date(date),
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

      // ===== خصم الكميات من مخزون المنتجات =====
      for (const it of validItems) {
        if (it.productId) {
          await tx.product.update({
            where: { id: it.productId },
            data: {
              quantity: { decrement: Number(it.quantity) },
              updatedAt: new Date(),
            },
          })
        }
      }

      // ===== إنشاء حركة خزينة (إيداع المبلغ المدفوع) =====
      if (paidAmount > 0) {
        await tx.treasuryTransaction.create({
          data: {
            type: 'deposit',
            amount: paidAmount,
            date: new Date(date),
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
