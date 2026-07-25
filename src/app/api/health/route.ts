import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

export const dynamic = 'force-dynamic'

// GET /api/health — فحص السيرفر والاتصال بقاعدة البيانات وجاهزية المخطط (بدون تسجيل دخول)
export async function GET() {
  const startedAt = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    const companies = await db.company.count()

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      schema: 'ready',
      companies,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    // لا نكشف تفاصيل الاتصال أو بيانات الاعتماد
    console.error('Health check failed:', e.message)
    return NextResponse.json(
      { status: 'error', database: 'unavailable', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}
