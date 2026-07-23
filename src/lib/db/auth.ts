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

export async function login(username: string, password: string): Promise<{ success: boolean; error?: string; user?: SessionUser }> {
  try {
    const user = await userRepository.verifyPassword(username, password)
    if (!user) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
    }

    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
    return { success: true, user: sessionUser }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function register(username: string, password: string, name: string): Promise<{ success: boolean; error?: string; user?: SessionUser }> {
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
  return userRepository.hasAnyUser()
}

