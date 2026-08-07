import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

// POST /api/auth/reset-registration — حذف جميع المستخدمين لإعادة فتح التسجيل
// محمي بـ RESET_KEY من متغيرات البيئة
export async function POST(req: NextRequest) {
  try {
    // التحقق من المفتاح السري
    const body = await req.json()
    const resetKey = body.resetKey

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

    // حذف جميع المستخدمين
    const count = await db.user.count()
    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا يوجد مستخدمين لحذفهم — التسجيل مفتوح بالفعل',
        deletedCount: 0,
      })
    }

    await db.user.deleteMany()

    return NextResponse.json({
      success: true,
      message: `تم حذف ${count} مستخدم. التسجيل مفتوح الآن.`,
      deletedCount: count,
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
