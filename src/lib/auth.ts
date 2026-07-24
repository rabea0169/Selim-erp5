import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from '@/lib/db-server'

const SESSION_COOKIE = 'factory_session'
const SESSION_EXPIRY_DAYS = 30

// ====== أنواع الجلسة ======
export interface SessionData {
  userId: string
  username: string
  companyId: string
  role: string
  expires: number
}

// ====== إنشاء session token ======
function createSessionToken(data: {
  userId: string
  username: string
  companyId: string
  role: string
}): string {
  const expires = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  const payload: SessionData = { ...data, expires }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

// ====== التحقق من session token ======
export function verifySessionToken(token: string | undefined): {
  userId: string
  username: string
  companyId: string
  role: string
} | null {
  if (!token) return null
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString()) as SessionData
    if (payload.expires < Date.now()) return null
    return {
      userId: payload.userId,
      username: payload.username,
      companyId: payload.companyId,
      role: payload.role,
    }
  } catch {
    return null
  }
}

// ====== الحصول على المستخدم الحالي من الكوكيز ======
export async function getCurrentUser(): Promise<{
  id: string
  username: string
  name: string
  role: string
  companyId: string
} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const session = verifySessionToken(token)
  if (!session) return null

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      companyId: true,
    },
  })
  return user
}

// ====== مساعد: تعيين الكوكيز ======
async function setSessionCookie(data: {
  userId: string
  username: string
  companyId: string
  role: string
}) {
  const token = createSessionToken(data)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  })
}

// ====== تسجيل الدخول ======
export async function loginUser(username: string, password: string): Promise<{
  success: boolean
  error?: string
  user?: { id: string; username: string; name: string; role: string; companyId: string }
}> {
  const user = await db.user.findUnique({
    where: { username },
    include: { company: { select: { id: true } } },
  })
  if (!user) {
    return { success: false, error: 'اسم المستخدم غير موجود' }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return { success: false, error: 'كلمة المرور غير صحيحة' }
  }

  await setSessionCookie({
    userId: user.id,
    username: user.username,
    companyId: user.companyId,
    role: user.role,
  })

  return {
    success: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, companyId: user.companyId },
  }
}

// ====== تسجيل الخروج ======
export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

// ====== إنشاء مستخدم جديد مع الشركة ======
export async function registerUser(
  username: string,
  password: string,
  name: string,
  companyName: string,
  phone?: string,
  securityQuestion?: string,
  securityAnswer?: string,
): Promise<{
  success: boolean
  error?: string
  user?: { id: string; username: string; name: string; role: string; companyId: string }
}> {
  if (!username?.trim() || username.length < 3) {
    return { success: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }
  }
  if (!name?.trim()) {
    return { success: false, error: 'الاسم مطلوب' }
  }
  if (!companyName?.trim()) {
    return { success: false, error: 'اسم الشركة مطلوب' }
  }
  if (!securityQuestion?.trim() || !securityAnswer?.trim()) {
    return { success: false, error: 'سؤال الأمان والإجابة مطلوبان' }
  }

  // التحقق من وجود المستخدم
  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    return { success: false, error: 'اسم المستخدم موجود بالفعل' }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const securityAnswerHash = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 10)

  // إنشاء الشركة والمستخدم في transaction
  const result = await db.$transaction(async (tx) => {
    // إنشاء الشركة
    const company = await tx.company.create({
      data: {
        name: companyName.trim(),
      },
    })

    // إنشاء المستخدم كـ owner
    const user = await tx.user.create({
      data: {
        username: username.trim(),
        passwordHash,
        name: name.trim(),
        phone: phone?.trim() || null,
        role: 'owner',
        securityQuestion: securityQuestion.trim(),
        securityAnswerHash,
        companyId: company.id,
      },
    })

    return { user, company }
  })

  // تسجيل الدخول تلقائياً
  await setSessionCookie({
    userId: result.user.id,
    username: result.user.username,
    companyId: result.company.id,
    role: result.user.role,
  })

  return {
    success: true,
    user: {
      id: result.user.id,
      username: result.user.username,
      name: result.user.name,
      role: result.user.role,
      companyId: result.company.id,
    },
  }
}

// ====== إضافة مستخدم لشركة موجودة ======
export async function addUserToCompany(
  username: string,
  password: string,
  name: string,
  role: string,
  companyId: string,
  phone?: string,
  securityQuestion?: string,
  securityAnswer?: string,
): Promise<{
  success: boolean
  error?: string
  user?: { id: string; username: string; name: string; role: string; companyId: string }
}> {
  if (!username?.trim() || username.length < 3) {
    return { success: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }
  }
  if (!name?.trim()) {
    return { success: false, error: 'الاسم مطلوب' }
  }
  if (!securityQuestion?.trim() || !securityAnswer?.trim()) {
    return { success: false, error: 'سؤال الأمان والإجابة مطلوبان' }
  }

  const validRoles = ['owner', 'admin', 'manager', 'employee', 'viewer']
  if (!validRoles.includes(role)) {
    return { success: false, error: 'دور المستخدم غير صالح' }
  }

  // التحقق من الشركة
  const company = await db.company.findUnique({ where: { id: companyId } })
  if (!company) {
    return { success: false, error: 'الشركة غير موجودة' }
  }

  // التحقق من عدد المستخدمين
  const userCount = await db.user.count({ where: { companyId } })
  if (userCount >= company.maxUsers) {
    return { success: false, error: 'تم الوصول للحد الأقصى من المستخدمين' }
  }

  // التحقق من وجود المستخدم
  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    return { success: false, error: 'اسم المستخدم موجود بالفعل' }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const securityAnswerHash = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 10)

  const user = await db.user.create({
    data: {
      username: username.trim(),
      passwordHash,
      name: name.trim(),
      phone: phone?.trim() || null,
      role,
      securityQuestion: securityQuestion.trim(),
      securityAnswerHash,
      companyId,
    },
  })

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    },
  }
}

// ====== استعادة كلمة المرور ======
export async function getSecurityQuestion(username: string): Promise<{
  success: boolean
  error?: string
  question?: string
}> {
  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, securityQuestion: true },
  })
  if (!user) {
    return { success: false, error: 'اسم المستخدم غير موجود' }
  }
  if (!user.securityQuestion) {
    return { success: false, error: 'لم يتم تعيين سؤال أمان لهذا الحساب' }
  }
  return { success: true, question: user.securityQuestion }
}

export async function verifySecurityAnswer(
  username: string,
  answer: string,
  newPassword: string,
): Promise<{
  success: boolean
  error?: string
}> {
  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, securityAnswerHash: true },
  })
  if (!user || !user.securityAnswerHash) {
    return { success: false, error: 'اسم المستخدم غير موجود أو لم يتم تعيين سؤال أمان' }
  }

  const valid = await bcrypt.compare(answer.trim().toLowerCase(), user.securityAnswerHash)
  if (!valid) {
    return { success: false, error: 'إجابة سؤال الأمان غير صحيحة' }
  }

  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  return { success: true }
}

// ====== التحقق من وجود أي مستخدم ======
export async function hasAnyUser(): Promise<boolean> {
  const count = await db.user.count()
  return count > 0
}
