import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    // عزل الشركات إجباري — companyId null يطابق السجلات القديمة غير المربوطة فقط
    const where: any = { companyId }
    if (q) {
      where.AND = [
        { companyId },
        {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { address: { contains: q } },
          ],
        },
      ]
    }
    const customers = await db.customer.findMany({
      where,
      include: {
        _count: { select: { sales: true } },
        sales: {
          select: { total: true, paid: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // fix(receivables): تجميع المرتجعات والسدادات العامة (غير المرتبطة بفاتورة) لكل عميل
    // حتى يكون totalRemaining = مبيعات - مدفوع - مرتجعات - سدادات عامة (مطابقاً لكشف الحساب)
    const ids = customers.map((c: any) => c.id)
    const [returnAgg, standaloneAgg] = ids.length
      ? await Promise.all([
          db.saleReturn.groupBy({
            by: ['customerId_ref'],
            where: { companyId, customerId_ref: { in: ids } },
            _sum: { total: true },
          }),
          db.payment.groupBy({
            by: ['partyId'],
            where: { companyId, type: 'customer_payment', invoiceId: null, partyId: { in: ids } },
            _sum: { amount: true },
          }),
        ])
      : [[], []]
    const returnsMap = new Map((returnAgg as any[]).map((r: any) => [r.customerId_ref, r._sum?.total || 0]))
    const standaloneMap = new Map((standaloneAgg as any[]).map((p: any) => [p.partyId, p._sum?.amount || 0]))

    const withTotals = customers.map((c: any) => {
      const totalSales = c.sales.reduce((s: number, x: any) => s + x.total, 0)
      const totalPaid = c.sales.reduce((s: number, x: any) => s + x.paid, 0)
      const totalReturns = returnsMap.get(c.id) || 0
      const standalonePayments = standaloneMap.get(c.id) || 0
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        notes: c.notes,
        creditLimit: c.creditLimit,
        loyaltyPoints: c.loyaltyPoints,
        openingBalance: c.openingBalance,
        createdAt: c.createdAt,
        totalSales,
        totalPaid,
        totalReturns,
        totalRemaining: Math.max(0, totalSales - totalPaid - totalReturns - standalonePayments),
        salesCount: c._count.sales,
      }
    })
    return NextResponse.json({ customers: withTotals })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const body = await req.json()
    const { name, phone, address, notes, creditLimit, openingBalance } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم العميل مطلوب' },
        { status: 400 }
      )
    }

    const customer = await db.customer.create({
      data: {
        companyId: user.companyId ?? null,
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        creditLimit: Number(creditLimit) > 0 ? Number(creditLimit) : null,
        openingBalance: Number(openingBalance) > 0 ? Number(openingBalance) : 0,
      },
    })
    return NextResponse.json({ customer })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
