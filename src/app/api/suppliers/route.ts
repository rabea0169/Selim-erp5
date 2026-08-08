import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
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
    const suppliers = await db.supplier.findMany({
      where,
      include: {
        _count: { select: { purchases: true } },
        purchases: {
          select: { total: true, paid: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // fix(receivables): تجميع مرتجعات الشراء والسدادات العامة لكل مورد + إرجاع openingBalance/creditLimit
    const ids = suppliers.map((s: any) => s.id)
    const [returnAgg, standaloneAgg] = ids.length
      ? await Promise.all([
          db.purchaseReturn.groupBy({
            by: ['supplierId_ref'],
            where: { companyId, supplierId_ref: { in: ids } },
            _sum: { total: true },
          }),
          db.payment.groupBy({
            by: ['partyId'],
            where: { companyId, type: 'supplier_payment', invoiceId: null, partyId: { in: ids } },
            _sum: { amount: true },
          }),
        ])
      : [[], []]
    const returnsMap = new Map((returnAgg as any[]).map((r: any) => [r.supplierId_ref, r._sum?.total || 0]))
    const standaloneMap = new Map((standaloneAgg as any[]).map((p: any) => [p.partyId, p._sum?.amount || 0]))

    const withTotals = suppliers.map((s: any) => {
      const totalPurchases = s.purchases.reduce((sum: number, x: any) => sum + x.total, 0)
      const totalPaid = s.purchases.reduce((sum: number, x: any) => sum + x.paid, 0)
      const totalReturns = returnsMap.get(s.id) || 0
      const standalonePayments = standaloneMap.get(s.id) || 0
      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        address: s.address,
        notes: s.notes,
        creditLimit: s.creditLimit,
        openingBalance: s.openingBalance,
        createdAt: s.createdAt,
        totalPurchases,
        totalPaid,
        totalReturns,
        totalRemaining: Math.max(0, totalPurchases - totalPaid - totalReturns - standalonePayments),
        purchasesCount: s._count.purchases,
      }
    })
    return NextResponse.json({ suppliers: withTotals })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })

    const body = await req.json()
    const { name, phone, address, notes, creditLimit, openingBalance } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم المورد مطلوب' },
        { status: 400 }
      )
    }

    const supplier = await db.supplier.create({
      data: {
        companyId: scope.companyId,
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        creditLimit: Number(creditLimit) > 0 ? Number(creditLimit) : null,
        openingBalance: Number(openingBalance) > 0 ? Number(openingBalance) : 0,
      },
    })
    return NextResponse.json({ supplier })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
