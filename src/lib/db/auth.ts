'use client'

import { userRepository } from './repositories'
import type { User } from './types'

const SESSION_KEY = 'factory_session_user'

const SECURITY_QUESTIONS = [
  'ما هو اسم والدتك؟',
  'ما هي مدينتك المفضلة؟',
  'ما هو اسم مدرستك الابتدائية؟',
  'ما هو اسم حيوانك الأليف الأول؟',
  'ما هي سيارتك المفضلة؟',
]

export interface SessionUser {
  id: string
  username: string
  name: string
  role: string
  companyId: string
}

async function checkServerUser(username: string, password: string): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then((r) => r.json())
    if (res.user) return res.user
    return null
  } catch {
    return null
  }
}

async function checkServerHasUsers(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/register').then((r) => r.json())
    return res.hasUsers === true
  } catch {
    return false
  }
}

export async function login(username: string, password: string): Promise<{ success: boolean; error?: string; user?: SessionUser }> {
  try {
    const serverUser = await checkServerUser(username, password)
    if (serverUser) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(serverUser))
      return { success: true, user: serverUser }
    }

    const user = await userRepository.verifyPassword(username, password)
    if (!user) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
    }

    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      companyId: '',
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
    return { success: true, user: sessionUser }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function register(
  username: string,
  password: string,
  name: string,
  companyName?: string,
  phone?: string,
  securityQuestion?: string,
  securityAnswer?: string,
): Promise<{ success: boolean; error?: string; user?: SessionUser }> {
  try {
    if (!username || username.length < 3) {
      return { success: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
    }
    if (!password || password.length < 4) {
      return { success: false, error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }
    }
    if (!name?.trim()) {
      return { success: false, error: 'الاسم مطلوب' }
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name, companyName, phone, securityQuestion, securityAnswer }),
      }).then((r) => r.json())

      if (res.error) {
        return { success: false, error: res.error }
      }
      if (res.user) {
        const sessionUser: SessionUser = res.user
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
        await userRepository.createWithPassword({ username, password, name })
        return { success: true, user: sessionUser }
      }
    } catch {
      // لو السيرفر مش متاح، نكمل محلياً
    }

    const existing = await userRepository.getByUsername(username)
    if (existing) {
      return { success: false, error: 'اسم المستخدم موجود بالفعل' }
    }

    const user = await userRepository.createWithPassword({ username, password, name })
    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      companyId: '',
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
    return { success: true, user: sessionUser }
  } catch (e: any) {
    return { success: false, error: e.message }
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

export function logout(): void {
  localStorage.removeItem(SESSION_KEY)
}

export async function hasAnyUser(): Promise<boolean> {
  const serverHas = await checkServerHasUsers()
  if (serverHas) return true
  return userRepository.hasAnyUser()
}

export async function getSecurityQuestion(username: string): Promise<{ success: boolean; error?: string; question?: string }> {
  try {
    const res = await fetch(`/api/auth/forgot-password?username=${encodeURIComponent(username)}`).then((r) => r.json())
    if (res.error) return { success: false, error: res.error }
    return { success: true, question: res.question }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function resetPassword(
  username: string,
  answer: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, answer, newPassword }),
    }).then((r) => r.json())
    if (res.error) return { success: false, error: res.error }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export { SECURITY_QUESTIONS }
