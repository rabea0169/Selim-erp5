import { cookies } from 'next/headers'
import { db } from './db-server'
import { hashSync, compareSync } from 'bcryptjs'

export interface ServerUser {
  id: string
  username: string
  name: string
  role: string
  phone?: string
  companyId: string
}

const COOKIE_NAME = 'session'

// ====== getCurrentUser: يقرأ المستخدم من cookie ======
export async function getCurrentUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get(COOKIE_NAME)?.value
    if (!sessionId) return null

    const user = await db.user.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        phone: true,
        companyId: true,
      },
    })

    return user
  } catch {
    return null
  }
}

// ====== hasAnyUser: هل يوجد أي مستخدم في النظام ======
export async function hasAnyUser(): Promise<boolean> {
  const count = await db.user.count()
  return count > 0
}

// ====== loginUser: تسجيل دخول + وضع cookie ======
export async function loginUser(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: any }> {
  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
  }

  const valid = compareSync(password, user.passwordHash)
  if (!valid) {
    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 يوم
    path: '/',
  })

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
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
): Promise<{ success: boolean; error?: string; user?: any }> {
  if (!username || username.length < 3) {
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

  // إنشاء إعدادات المصنع الافتراضية
  await db.factorySettings.create({
    data: {
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

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
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
): Promise<{ success: boolean; error?: string; user?: any }> {
  if (!username || username.length < 3) {
    return { success: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }
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
      phone: user.phone,
      companyId: user.companyId,
    },
  }
}

// ====== logoutUser: حذف cookie ======
export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
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

  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل' }
  }

  const newPasswordHash = hashSync(newPassword, 10)
  await db.user.update({
    where: { username },
    data: { passwordHash: newPasswordHash },
  })

  return { success: true }
}
