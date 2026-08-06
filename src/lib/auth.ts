import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from '@/lib/db-server'
import { createSessionToken, verifySessionToken } from '@/lib/session'

const SESSION_COOKIE = 'factory_session'
const SESSION_EXPIRY_DAYS = 30

export { createSessionToken, verifySessionToken }

// الحصول على المستخدم الحالي ومُعرّف شركته من الجلسة والقاعدة
export async function getCurrentUser(): Promise<{
  id: string
  companyId: string | null
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
    select: { id: true, companyId: true, username: true, name: true, role: true },
  })
  return user
}

export async function isRegistrationAllowed(): Promise<boolean> {
  return true // السماح بتعدد الشركات لإنشاء حسابات مستقلة لكل شركة
}

// تسجيل الدخول
export async function loginUser(username: string, password: string): Promise<{
  success: boolean
  error?: string
  user?: { id: string; companyId: string | null; username: string; name: string; role: string }
}> {
  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    return { success: false, error: 'اسم المستخدم غير موجود' }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return { success: false, error: 'كلمة المرور غير صحيحة' }
  }

  const token = await createSessionToken(user.id, user.username, user.role, user.companyId || undefined)
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
    user: { id: user.id, companyId: user.companyId, username: user.username, name: user.name, role: user.role },
  }
}

// تسجيل الخروج
export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

// إنشاء شركة جديدة ومستخدم مدير لها لتضمين تعدد الشركات وعزل البيانات 100%
export async function registerUser(
  username: string,
  password: string,
  name: string
): Promise<{
  success: boolean
  error?: string
  user?: { id: string; companyId: string | null; username: string; name: string; role: string }
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

  let user: any
  try {
    user = await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { username: username.trim() } })
      if (existing) throw new Error('اسم المستخدم موجود بالفعل')

      // إنشاء شركة خاصة وحساب مدير لها
      const company = await tx.company.create({
        data: { name: `شركة ${name.trim()}` },
      })

      const passwordHash = await bcrypt.hash(password, 12)
      return tx.user.create({
        data: {
          username: username.trim(),
          companyId: company.id,
          passwordHash,
          name: name.trim(),
          role: 'admin',
        },
      })
    })
  } catch (e: any) {
    if (e.message === 'اسم المستخدم موجود بالفعل') {
      return { success: false, error: 'اسم المستخدم موجود بالفعل' }
    }
    throw e
  }

  // تسجيل الدخول تلقائياً بعد التسجيل
  const token = await createSessionToken(user.id, user.username, user.role, user.companyId || undefined)
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
    user: { id: user.id, companyId: user.companyId, username: user.username, name: user.name, role: user.role },
  }
}

// التحقق من وجود أي مستخدم
export async function hasAnyUser(): Promise<boolean> {
  const count = await db.user.count()
  return count > 0
}
