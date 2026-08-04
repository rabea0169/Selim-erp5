import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from '@/lib/db-server'
import { createSessionToken, verifySessionToken } from '@/lib/session'

const SESSION_COOKIE = 'factory_session'
const SESSION_EXPIRY_DAYS = 30

export { createSessionToken, verifySessionToken }

// الحصول على المستخدم الحالي من الكوكيز
export async function getCurrentUser(): Promise<{
  id: string
  username: string
  name: string
  role: string
} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifySessionToken(token)
  if (!session) return null

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, name: true, role: true },
  })
  return user
}

export async function isRegistrationAllowed(): Promise<boolean> {
  const count = await db.user.count()
  return count === 0
}

// تسجيل الدخول
export async function loginUser(username: string, password: string): Promise<{
  success: boolean
  error?: string
  user?: { id: string; username: string; name: string; role: string }
}> {
  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    return { success: false, error: 'اسم المستخدم غير موجود' }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return { success: false, error: 'كلمة المرور غير صحيحة' }
  }

  const token = await createSessionToken(user.id, user.username, user.role)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  })

  return {
    success: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  }
}

// تسجيل الخروج
export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

// إنشاء مستخدم جديد
export async function registerUser(
  username: string,
  password: string,
  name: string
): Promise<{
  success: boolean
  error?: string
  user?: { id: string; username: string; name: string; role: string }
}> {
  if (!username?.trim() || username.length < 3) {
    return { success: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
  }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { success: false, error: 'كلمة المرور يجب أن تحتوي على أحرف وأرقام' }
    }
  if (!name?.trim()) {
    return { success: false, error: 'الاسم مطلوب' }
  }

  // Fix M: Use interactive transaction to prevent race condition
  let user: any
  try {
    user = await db.$transaction(async (tx) => {
      const count = await tx.user.count()
      if (count > 0) throw new Error('التسجيل مغلق')

      const existing = await tx.user.findUnique({ where: { username } })
      if (existing) throw new Error('اسم المستخدم موجود بالفعل')

      const passwordHash = await bcrypt.hash(password, 12)
      return tx.user.create({
        data: {
          username: username.trim(),
          passwordHash,
          name: name.trim(),
          role: 'admin',
        },
      })
    })
  } catch (e: any) {
    if (e.message === 'التسجيل مغلق') {
      return { success: false, error: 'التسجيل مغلق — يرجى التواصل مع المدير' }
    }
    if (e.message === 'اسم المستخدم موجود بالفعل') {
      return { success: false, error: 'اسم المستخدم موجود بالفعل' }
    }
    throw e
  }

  // تسجيل الدخول تلقائياً بعد التسجيل
  const token = await createSessionToken(user.id, user.username, user.role)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  })

  return {
    success: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  }
}

// التحقق من وجود أي مستخدم (لاستخدامها في شاشة تسجيل الدخول)
export async function hasAnyUser(): Promise<boolean> {
  const count = await db.user.count()
  return count > 0
}
