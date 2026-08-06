/**
 * التحقق من أن المستخدم الحالي هو admin
 * يُستخدم في نقاط النهاية الحساسة
 */
import { verifySessionToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { db } from '@/lib/db-server'

const SESSION_COOKIE = 'factory_session'

export async function requireAdmin(): Promise<
  { ok: true; userId: string; username: string }
  | { ok: false; error: string; status: number }
> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    const session = await verifySessionToken(token)
    if (!session) {
      return { ok: false, error: 'غير مصرح — يجب تسجيل الدخول أولاً', status: 401 }
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, role: true },
    })

    if (!user) {
      return { ok: false, error: 'المستخدم غير موجود', status: 401 }
    }

    if (user.role !== 'admin') {
      return { ok: false, error: 'غير مصرح — يتطلب صلاحيات مدير', status: 403 }
    }

    return { ok: true, userId: user.id, username: user.username }
  } catch {
    return { ok: false, error: 'خطأ في التحقق من الصلاحيات', status: 500 }
  }
}
