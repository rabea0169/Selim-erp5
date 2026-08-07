'use client'

import { userRepository } from './repositories'
import type { User } from './types'

const SESSION_KEY = 'factory_session_user'

export interface SessionUser {
  id: string
  username: string
  name: string
  role: string
}

// التحقق من السيرفر أولاً ثم IndexedDB
async function checkServerUser(username: string, password: string): Promise<{ user: SessionUser | null; serverReachable: boolean }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!response.ok) {
      // Fix V: For non-auth errors (not 401/403), treat server as unreachable
      // to allow fallback to local auth instead of showing credential error
      if (response.status !== 401 && response.status !== 403) {
        return { user: null, serverReachable: false }
      }
      return { user: null, serverReachable: true }
    }
    const res = await response.json()
    // لو حصلنا على رد من السيرفر، يبقى السيرفر شغال
    return { user: res.user || null, serverReachable: true }
  } catch {
    return { user: null, serverReachable: false } // لو السيرفر مش متاح
  }
}

// التحقق من السيرفر لو فيه مستخدمين
async function checkServerHasUsers(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/register')
    if (!response.ok) return false
    const res = await response.json()
    return res.hasUsers === true
  } catch {
    return false
  }
}

export async function login(username: string, password: string): Promise<{ success: boolean; error?: string; user?: SessionUser }> {
  try {
    // 1. محاولة تسجيل الدخول من السيرفر أولاً
    const { user: serverUser, serverReachable } = await checkServerUser(username, password)
    if (serverUser) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(serverUser))
      // مزامنة المستخدم محلياً لضمان العمل offline بعد ذلك
      try {
        const existingLocal = await userRepository.getByUsername(username)
        if (!existingLocal) {
          await userRepository.createWithPassword({ username, password: '', name: serverUser.name, role: serverUser.role })
          console.log('[Auth] Server login OK — user synced to local IndexedDB')
        }
      } catch (localErr: any) {
        console.warn('[Auth] Server login OK but local sync failed:', localErr.message)
      }
      return { success: true, user: serverUser }
    }

    // 2. لو السيرفر رفض (بيانات خاطئة) أو مش متاح، نحاول محلياً
    try {
      const user = await userRepository.verifyPassword(username, password)
      if (!user) {
        // لو السيرفر كان متاح ورفض، يبقى البيانات فعلاً غلط
        if (serverReachable) {
          return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
        }
        // لو السيرفر مش متاح والمحلي فاضي، ممكن يكون حدث مسح للبيانات المحلية
        console.warn('[Auth] Both server and local login failed. Server was unreachable and local user not found.')
        return { success: false, error: 'لا يمكن تسجيل الدخول حالياً. تأكد من اتصالك بالإنترنت أو أنشئ حساباً جديداً.' }
      }

      const sessionUser: SessionUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
      return { success: true, user: sessionUser }
    } catch (dbErr: any) {
      // خطأ في قاعدة البيانات المحلية — نعيد المحاولة مرة واحدة
      console.error('[Auth] Local DB login failed, retrying...', dbErr.message)
      try {
        const user = await userRepository.verifyPassword(username, password)
        if (!user) {
          if (serverReachable) {
            return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
          }
          return { success: false, error: 'لا يمكن تسجيل الدخول حالياً. تأكد من اتصالك بالإنترنت.' }
        }
        const sessionUser: SessionUser = {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
        return { success: true, user: sessionUser }
      } catch (retryErr: any) {
        console.error('[Auth] Local DB login retry also failed:', retryErr.message)
        return { success: false, error: 'حدث خطأ في قاعدة البيانات المحلية. حاول تحديث الصفحة.' }
      }
    }
  } catch (e: any) {
    return { success: false, error: e.message || 'خطأ غير متوقع في تسجيل الدخول' }
  }
}

export async function register(username: string, password: string, name: string): Promise<{ success: boolean; error?: string; user?: SessionUser }> {
  try {
    if (!username || username.length < 3) {
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

    // 1. محاولة التسجيل على السيرفر أولاً
    let serverRegistrationClosed = false
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name }),
      })

      // تحقق إن الرد JSON صالح قبل محاولة قراءته
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        console.warn('[Auth] Server returned non-JSON response:', response.status, contentType)
        // السيرفر مش متاح أو يرجع HTML (502/503) — نكمل محلياً
      } else {
        const res = await response.json()

        if (res.error) {
          const isDuplicateUser = res.error.includes('موجود بالفعل')
            || res.error.includes('already exists')
            || res.error.includes('Unique constraint')

          // لو التسجيل مغلق على السيرفر (يوجد مستخدم بالفعل)
          if (res.error.includes('التسجيل مغلق') || res.error.includes('registration closed')) {
            console.log('[Auth] Registration closed on server, falling back to local account')
            serverRegistrationClosed = true
            // لا نرجع خطأ هنا — نكمل للتسجيل المحلي
          } else if (isDuplicateUser) {
            console.log('[Auth] User already exists on server, attempting login instead of register')
            const loginResult = await login(username, password)
            if (loginResult.success) {
              return loginResult
            }
            return { success: false, error: 'اسم المستخدم موجود بالفعل على السيرفر. حاول تسجيل الدخول.' }
          } else {
            return { success: false, error: res.error }
          }
        }

        if (res.user) {
          const sessionUser: SessionUser = res.user
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
          try {
            await userRepository.createWithPassword({ username, password, name })
          } catch (localErr: any) {
            console.warn('[Auth] Server register OK but local sync failed:', localErr.message)
          }
          return { success: true, user: sessionUser }
        }
      }
    } catch (err: any) {
      console.warn('[Auth] Server register failed, falling back to local:', err?.message || 'network error')
    }

    // 2. التحقق المحلي
    const existing = await userRepository.getByUsername(username)
    if (existing) {
      return { success: false, error: 'اسم المستخدم موجود بالفعل محلياً. حاول تسجيل الدخول.' }
    }

    // 3. إنشاء الحساب محلياً (يعمل offline)
    try {
      const user = await userRepository.createWithPassword({ username, password, name })
      const sessionUser: SessionUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
      console.log('[Auth] Local account created successfully:', username)
      return { success: true, user: sessionUser }
    } catch (localErr: any) {
      console.error('[Auth] Local registration failed:', localErr?.message)
      if (serverRegistrationClosed) {
        return { success: false, error: 'التسجيل مغلق على السيرفر وفشل إنشاء حساب محلي. تأكد أن متصفحك يسمح بتخزين البيانات.' }
      }
      return { success: false, error: 'فشل إنشاء الحساب. تأكد أن متصفحك يسمح بتخزين البيانات محلياً.' }
    }
  } catch (e: any) {
    console.error('[Auth] Register unexpected error:', e?.message)
    return { success: false, error: e?.message || 'حدث خطأ غير متوقع أثناء التسجيل' }
  }
}

export function getCurrentUser(): SessionUser | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  // مسح الجلسة المحلية
  localStorage.removeItem(SESSION_KEY)
  // محاولة مسح الجلسة من السيرفر أيضاً
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // لو السيرفر مش متاح، مش مشكلة — الجلسة المحلية اتمسحت
  }
}

// التحقق من وجود مستخدمين - يفحص السيرفر أولاً ثم المحلي
export async function hasAnyUser(): Promise<boolean> {
  // 1. فحص السيرفر
  try {
    const response = await fetch('/api/auth/register')
    if (response.ok) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const res = await response.json()
        if (res.hasUsers === true) return true
      }
    }
  } catch {
    // السيرفر مش متاح، نكمل محلياً
  }

  // 2. فحص محلي مع معالجة الأخطاء
  try {
    return await userRepository.hasAnyUser()
  } catch (e: any) {
    console.error('[Auth] hasAnyUser local check failed:', e.message)
    // لو المحلي فشل، نفترض مفيش مستخدمين عشان نعرض شاشة التسجيل
    return false
  }
}

// معلومات حالة التسجيل من السيرفر
export async function getRegistrationStatus(): Promise<{ serverReachable: boolean; hasUsers: boolean; registrationOpen: boolean }> {
  try {
    const response = await fetch('/api/auth/register')
    if (response.ok) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const res = await response.json()
        return {
          serverReachable: true,
          hasUsers: !!res.hasUsers,
          registrationOpen: !!res.registrationOpen,
        }
      }
    }
    return { serverReachable: false, hasUsers: false, registrationOpen: false }
  } catch {
    return { serverReachable: false, hasUsers: false, registrationOpen: false }
  }
}
