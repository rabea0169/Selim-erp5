import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'

// GET /api/audit?entityType=&from=&to=&limit=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entityType')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = Math.min(Number(searchParams.get('limit')) || 200, 1000)

    const where: any = withCompanyScope({}, auth.companyId)
    if (entityType) where.entityType = entityType
    if (from || to) {
      where.timestamp = {}
      if (from) where.timestamp.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.timestamp.lte = toDate
      }
    }

    const logs = await db.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, take: limit })
    return NextResponse.json({ logs })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/audit
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { action, entityType, entityId, description, metadata } = body

    if (!action?.trim() || !entityType?.trim()) {
      return NextResponse.json({ error: 'نوع العملية والكيان مطلوبان' }, { status: 400 })
    }

    // المستخدم يُؤخذ من الجلسة وليس من جسم الطلب
    const log = await db.auditLog.create({
      data: {
        userId: auth.user.id,
        userName: auth.user.name,
        action: action.trim(),
        entityType: entityType.trim(),
        entityId: entityId || null,
        description: description?.trim() || '',
        metadata: metadata ?? undefined,
        companyId: auth.companyId,
      },
    })

    return NextResponse.json({ log })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
