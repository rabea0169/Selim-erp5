'use client'

import { userRepository } from './repositories'
import { apiFetch } from './api-client'

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

export async function login(username: string, password: string): Promise<{ success: boolean; error?: string; user?: SessionUser }> {
  try {
    const res = await apiFetch<{ user?: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (!res.user) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(res.user))
    return { success: true, user: res.user }
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

    const res = await apiFetch<{ user?: SessionUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, name, companyName, phone, securityQuestion, securityAnswer }),
    })

    if (!res.user) {
      return { success: false, error: 'تعذر إنشاء الحساب' }
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(res.user))
    return { success: true, user: res.user }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function getCurrentUser(): SessionUser | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    return stored ? JSON.parse(stored) : null
  } catch (e) {
    console.error('[auth] جلسة محفوظة تالفة، سيتم حذفها:', e)
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY)
}

export async function hasAnyUser(): Promise<boolean> {
  return userRepository.hasAnyUser()
}

export async function getSecurityQuestion(username: string): Promise<{ success: boolean; error?: string; question?: string }> {
  try {
    const res = await apiFetch<{ question?: string }>(`/api/auth/forgot-password?username=${encodeURIComponent(username)}`)
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
    await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ username, answer, newPassword }),
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export { SECURITY_QUESTIONS }
