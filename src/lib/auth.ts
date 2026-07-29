import { cookies } from 'next/headers'
import { db } from './db-server'
import { hashSync, compareSync } from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export interface ServerUser {
  id: string
  username: string
  name: string
  role: string
  phone?: string
  companyId: string
}

const COOKIE_NAME = 'session'
const SESSION_DURATION_DAYS = 30
const MIN_PASSWORD_LENGTH = 8

// ====== getCurrentUser: يقرأ المستخدم من session token آمن ======
export async function getCurrentUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const session = await db.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            phone: true,
            companyId: true,
          },
        },
      },
    })

    if (!session) return null

    // التحقق من انتهاء الجلسة
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { token } }).catch(() => {})
      return null
    }

    return session.user
  } catch {
    return null
  }
}

// ====== hasAnyUser: هل يوجد أي مستخدم في النظام ======
export async function hasAnyUser(): Promise<boolean> {
  const count = await db.user.count()
  return count > 0
}

// ====== createSession: إنشاء جلسة آمنة بـ UUID عشوائي ======
async function createSession(userId: string): Promise<string> {
  const token = uuidv4()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  // حذف الجلسات المنتهية لنفس المستخدم
  await db.session.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } },
  })

  await db.session.create({
    data: { token, userId, expiresAt },
  })

  return token
}

// ====== setSessionCookie: ضبط cookie الجلسة ======
async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * SESSION_DURATION_DAYS,
    path: '/',
  })
}

// ====== loginUser: تسجيل دخول + إنشاء session آمن ======
export async function loginUser(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: ServerUser }> {
  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
  }

  const valid = compareSync(password, user.passwordHash)
  if (!valid) {
    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
  }

  const token = await createSession(user.id)
  await setSessionCookie(token)

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone ?? undefined,
      companyId: user.companyId,
    },
  }
}

// ====== registerUser: إنشاء حساب جديد + شركة (للمستخدم الأول) ======
export async function registerUser(
  username: string,
  password: string,
  name: string,
  companyName: string,
  phone?: string,
  securityQuestion?: string,
  securityAnswer?: string,
): Promise<{ success: boolean; error?: string; user?: ServerUser }> {
  if (!username || username.length < 3) {
    return { success: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل` }
  }
  if (!name?.trim()) {
    return { success: false, error: 'الاسم مطلوب' }
  }
  if (!companyName?.trim()) {
    return { success: false, error: 'اسم الشركة مطلوب' }
  }

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    return { success: false, error: 'اسم المستخدم موجود بالفعل' }
  }

  const passwordHash = hashSync(password, 10)
  const securityAnswerHash = securityAnswer ? hashSync(securityAnswer, 10) : null

  // إنشاء شركة
  const company = await db.company.create({
    data: { name: companyName },
  })

  // إنشاء المستخدم owner
  const user = await db.user.create({
    data: {
      username,
      passwordHash,
      name,
      phone,
      role: 'owner',
      securityQuestion,
      securityAnswerHash,
      companyId: company.id,
    },
  })

  // إنشاء إعدادات المصنع الافتراضية بـ ID مرتبط بالشركة
  await db.factorySettings.create({
    data: {
      id: company.id,
      factoryName: companyName,
      currency: 'ج.م',
      companyId: company.id,
    },
  })

  // إنشاء بنود مصاريف افتراضية
  const defaultCategories = [
    'إيجار', 'كهرباء ومياه', 'صيانة',
    'مواصلات', 'مواد تشغيل', 'أجور عمال',
    'مصاريف إدارية', 'أخرى',
  ]
  for (const catName of defaultCategories) {
    await db.expenseCategory.create({
      data: { name: catName, companyId: company.id },
    })
  }

  const token = await createSession(user.id)
  await setSessionCookie(token)

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone ?? undefined,
      companyId: user.companyId,
    },
  }
}

// ====== addUserToCompany: إضافة مستخدم لشركة موجودة ======
export async function addUserToCompany(
  username: string,
  password: string,
  name: string,
  role: string,
  companyId: string,
  phone?: string,
  securityQuestion?: string,
  securityAnswer?: string,
): Promise<{ success: boolean; error?: string; user?: ServerUser }> {
  if (!username || username.length < 3) {
    return { success: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل` }
  }
  if (!name?.trim()) {
    return { success: false, error: 'الاسم مطلوب' }
  }

  // لا يمكن إنشاء owner جديد
  if (role === 'owner') {
    return { success: false, error: 'لا يمكن إنشاء حساب مالك جديد' }
  }

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    return { success: false, error: 'اسم المستخدم موجود بالفعل' }
  }

  // التحقق من عدد المستخدمين في الشركة
  const userCount = await db.user.count({ where: { companyId } })
  const company = await db.company.findUnique({ where: { id: companyId } })
  if (company && userCount >= company.maxUsers) {
    return { success: false, error: 'وصلت إلى الحد الأقصى للمستخدمين في هذه الشركة' }
  }

  const passwordHash = hashSync(password, 10)
  const securityAnswerHash = securityAnswer ? hashSync(securityAnswer, 10) : null

  const validRoles = ['admin', 'manager', 'employee', 'viewer']
  const finalRole = validRoles.includes(role) ? role : 'employee'

  const user = await db.user.create({
    data: {
      username,
      passwordHash,
      name,
      phone,
      role: finalRole,
      securityQuestion,
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
      phone: user.phone ?? undefined,
      companyId: user.companyId,
    },
  }
}

// ====== logoutUser: حذف session من DB + cookie ======
export async function logoutUser(): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (token) {
      await db.session.deleteMany({ where: { token } })
      cookieStore.delete(COOKIE_NAME)
    }
  } catch {
    // تجاهل الأخطاء عند تسجيل الخروج
  }
}

// ====== getSecurityQuestion: الحصول على سؤال الأمان ======
export async function getSecurityQuestion(
  username: string,
): Promise<{ success: boolean; error?: string; question?: string }> {
  const user = await db.user.findUnique({
    where: { username },
    select: { securityQuestion: true },
  })
  if (!user) {
    return { success: false, error: 'اسم المستخدم غير موجود' }
  }
  if (!user.securityQuestion) {
    return { success: false, error: 'لم يتم إعداد سؤال الأمان لهذا الحساب' }
  }
  return { success: true, question: user.securityQuestion }
}

// ====== verifySecurityAnswer: التحقق من إجابة الأمان وتغيير كلمة المرور ======
export async function verifySecurityAnswer(
  username: string,
  answer: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    return { success: false, error: 'اسم المستخدم غير موجود' }
  }
  if (!user.securityAnswerHash) {
    return { success: false, error: 'لم يتم إعداد سؤال الأمان لهذا الحساب' }
  }

  const valid = compareSync(answer, user.securityAnswerHash)
  if (!valid) {
    return { success: false, error: 'إجابة الأمان غير صحيحة' }
  }

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `كلمة المرور الجديدة يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل` }
  }

  const newPasswordHash = hashSync(newPassword, 10)
  await db.user.update({
    where: { username },
    data: { passwordHash: newPasswordHash },
  })

  // إبطال جميع الجلسات الحالية للمستخدم بعد تغيير كلمة المرور
  await db.session.deleteMany({ where: { userId: user.id } })

  return { success: true }
}
