import { cookies } from 'next/headers'
import { db } from './db-server'
import bcrypt from 'bcryptjs'

export interface ServerUser {
  id: string
  username: string
  name: string
  role: string
  phone?: string | null
  companyId: string
}

const SESSION_COOKIE = 'selim_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 يوم

// ====== قراءة المستخدم الحالي من الـ Cookie ======
export async function getCurrentUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value
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

// ====== تسجيل الدخول — يضبط الـ Cookie ======
export async function loginUser(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: ServerUser }> {
  try {
    const user = await db.user.findFirst({
      where: { username: username.trim() },
    })

    if (!user) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
    }

    // ضبط الـ Cookie
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })

    const serverUser: ServerUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
      companyId: user.companyId,
    }

    return { success: true, user: serverUser }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ====== تسجيل الخروج — يحذف الـ Cookie ======
export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

// ====== التسجيل الأول — ينشئ شركة + مستخدم owner ======
export async function registerUser(
  username: string,
  password: string,
  name: string,
  companyName: string,
  phone?: string,
  securityQuestion?: string,
  securityAnswer?: string,
): Promise<{ success: boolean; error?: string; user?: ServerUser }> {
  try {
    if (!username || username.trim().length < 3) {
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

    const existing = await db.user.findFirst({ where: { username: username.trim() } })
    if (existing) {
      return { success: false, error: 'اسم المستخدم موجود بالفعل' }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const securityAnswerHash = securityAnswer
      ? await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10)
      : null

    // إنشاء الشركة والمستخدم في transaction واحدة
    const user = await db.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName.trim(),
        },
      })

      return tx.user.create({
        data: {
          username: username.trim(),
          passwordHash,
          name: name.trim(),
          role: 'owner',
          phone: phone?.trim() || null,
          securityQuestion: securityQuestion || null,
          securityAnswerHash,
          companyId: company.id,
        },
      })
    })

    // ضبط الـ Cookie
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })

    const serverUser: ServerUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
      companyId: user.companyId,
    }

    return { success: true, user: serverUser }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ====== إضافة مستخدم لشركة موجودة (من قِبَل owner/admin) ======
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
  try {
    if (!username || username.trim().length < 3) {
      return { success: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
    }
    if (!password || password.length < 4) {
      return { success: false, error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }
    }
    if (!name?.trim()) {
      return { success: false, error: 'الاسم مطلوب' }
    }

    const existing = await db.user.findFirst({ where: { username: username.trim() } })
    if (existing) {
      return { success: false, error: 'اسم المستخدم موجود بالفعل' }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const securityAnswerHash = securityAnswer
      ? await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10)
      : null

    const user = await db.user.create({
      data: {
        username: username.trim(),
        passwordHash,
        name: name.trim(),
        role: role || 'employee',
        phone: phone?.trim() || null,
        securityQuestion: securityQuestion || null,
        securityAnswerHash,
        companyId,
      },
    })

    const serverUser: ServerUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
      companyId: user.companyId,
    }

    return { success: true, user: serverUser }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ====== هل يوجد أي مستخدم في قاعدة البيانات؟ ======
export async function hasAnyUser(): Promise<boolean> {
  try {
    const count = await db.user.count()
    return count > 0
  } catch {
    return false
  }
}

// ====== سؤال الأمان ======
export async function getSecurityQuestion(
  username: string,
): Promise<{ success: boolean; error?: string; question?: string }> {
  try {
    const user = await db.user.findFirst({
      where: { username: username.trim() },
      select: { securityQuestion: true },
    })

    if (!user) {
      return { success: false, error: 'اسم المستخدم غير موجود' }
    }
    if (!user.securityQuestion) {
      return { success: false, error: 'لم يتم تعيين سؤال أمان لهذا الحساب' }
    }

    return { success: true, question: user.securityQuestion }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ====== التحقق من إجابة الأمان وتغيير كلمة المرور ======
export async function verifySecurityAnswer(
  username: string,
  answer: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل' }
    }

    const user = await db.user.findFirst({
      where: { username: username.trim() },
      select: { id: true, securityAnswerHash: true },
    })

    if (!user || !user.securityAnswerHash) {
      return { success: false, error: 'اسم المستخدم غير موجود أو لا يوجد سؤال أمان' }
    }

    const valid = await bcrypt.compare(answer.toLowerCase().trim(), user.securityAnswerHash)
    if (!valid) {
      return { success: false, error: 'إجابة الأمان غير صحيحة' }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
