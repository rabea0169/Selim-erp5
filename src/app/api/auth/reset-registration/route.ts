import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

// POST /api/auth/reset-registration — حذف مستخدمي شركة واحدة لإعادة فتح التسجيل
// محمي بـ RESET_KEY من متغيرات البيئة + يتطلب تحديد الشركة صراحةً
// Fix: كان يحذف مستخدمي كل الشركات — الآن مقيد بشركة محددة فقط
export async function POST(req: NextRequest) {
  try {
    // Rate limiting صارم: 5 محاولات في الدقيقة لكل IP لمنع التخمين المتكرر للمفتاح
    const ip = getClientIP(req)
    const { limited, retryAfter } = rateLimit(`reset-registration:${ip}`, 5, 60_000)
    if (limited) {
      return NextResponse.json(
        { error: `محاولات كثيرة جداً. حاول بعد ${retryAfter} ثانية` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await req.json()
    const resetKey = body.resetKey
    const targetCompanyId = body.companyId

    const expectedKey = process.env.RESET_KEY
    if (!expectedKey) {
      return NextResponse.json(
        { error: 'خاصية إعادة التعيين غير مفعّلة على هذا السيرفر' },
        { status: 403 }
      )
    }

    // مقارنة آمنة ضد timing attacks
    const provided = Buffer.from(String(resetKey ?? ''), 'utf8')
    const expected = Buffer.from(expectedKey, 'utf8')
    const keyValid = provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
    if (!keyValid) {
      return NextResponse.json(
        { error: 'مفتاح إعادة التعيين غير صحيح' },
        { status: 403 }
      )
    }

    // يجب تحديد الشركة المستهدفة صراحةً لمنع حذف مستخدمي شركات أخرى
    if (!targetCompanyId) {
      return NextResponse.json(
        { error: 'يجب تحديد companyId الخاصة بالشركة المستهدفة' },
        { status: 400 }
      )
    }

    const where = { companyId: String(targetCompanyId) }
    const count = await db.user.count({ where })
    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا يوجد مستخدمين لهذه الشركة — التسجيل مفتوح بالفعل',
        deletedCount: 0,
      })
    }

    await db.user.deleteMany({ where })

    return NextResponse.json({
      success: true,
      message: `تم حذف ${count} مستخدم من الشركة المحددة. التسجيل مفتوح الآن.`,
      deletedCount: count,
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
