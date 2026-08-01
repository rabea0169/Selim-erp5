import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db-server'

const SESSION_COOKIE = 'factory_session'
const SESSION_EXPIRY_DAYS = 30
const TOKEN_SECRET = process.env.TOKEN_SECRET
if (!TOKEN_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('TOKEN_SECRET environment variable is required in production')
  }
  console.warn('[Auth] ⚠️ TOKEN_SECRET not set — using dev-only fallback. NEVER use this in production!')
}
const _tokenSecret = TOKEN_SECRET || 'dev-only-fallback-never-use-in-prod'

// إنشاء session token ببيانات المستخدم + توقيع HMAC
function createSessionToken(userId: string, username: string, role: string = 'user'): string {
  const expires = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  const payload = JSON.stringify({ userId, username, role, expires })
  const signature = crypto.createHmac('sha256', _tokenSecret).update(payload).digest('hex')
  const tokenData = JSON.stringify({ payload, sig: signature })
  return Buffer.from(tokenData).toString('base64')
}

// التحقق من session token مع التحقق من التوقيع
export function verifySessionToken(token: string | undefined): { userId: string; username: string; role: string } | null {
  if (!token) return null
  try {
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString())
    const { payload, sig } = tokenData
    const expectedSig = crypto.createHmac('sha256', _tokenSecret).update(payload).digest('hex')
    if (sig !== expectedSig) return null
    const data = JSON.parse(payload)
    if (data.expires < Date.now()) return null
    return { userId: data.userId, username: data.username, role: data.role || 'user' }
  } catch {
    return null
  }
}

// الحصول على المستخدم الحالي من الكوكيز
export async function getCurrentUser(): Promise<{
  id: string
  username: string
  name: string
  role: string

} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const session = verifySessionToken(token)
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

  const token = createSessionToken(user.id, user.username, user.role)
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

  const canRegister = await isRegistrationAllowed()
  if (!canRegister) {
    return { success: false, error: 'التسجيل مغلق — يرجى التواصل مع المدير' }
  }

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    return { success: false, error: 'اسم المستخدم موجود بالفعل' }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      username: username.trim(),
      passwordHash,
      name: name.trim(),
      role: 'admin',
    },
  })

  // تسجيل الدخول تلقائياً بعد التسجيل
  const token = createSessionToken(user.id, user.username, user.role)
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
