import { NextResponse } from 'next/server'
import { getCurrentUser } from './auth'

// ====== أدوار المستخدمين ======
export type UserRole = 'owner' | 'admin' | 'manager' | 'employee' | 'viewer'

// ====== خريطة الصلاحيات ======
export const ROLE_PERMISSIONS: Record<UserRole, {
  create: boolean
  read: boolean
  update: boolean
  delete: boolean
  manageUsers: boolean
  manageSettings: boolean
  backup: boolean
}> = {
  owner: {
    create: true,
    read: true,
    update: true,
    delete: true,
    manageUsers: true,
    manageSettings: true,
    backup: true,
  },
  admin: {
    create: true,
    read: true,
    update: true,
    delete: true,
    manageUsers: true,
    manageSettings: true,
    backup: true,
  },
  manager: {
    create: true,
    read: true,
    update: true,
    delete: false,
    manageUsers: false,
    manageSettings: false,
    backup: true,
  },
  employee: {
    create: true,
    read: true,
    update: true,
    delete: false,
    manageUsers: false,
    manageSettings: false,
    backup: false,
  },
  viewer: {
    create: false,
    read: true,
    update: false,
    delete: false,
    manageUsers: false,
    manageSettings: false,
    backup: false,
  },
}

// ====== التحقق من الصلاحية ======
export function hasPermission(role: string, action: 'create' | 'read' | 'update' | 'delete' | 'manageUsers' | 'manageSettings' | 'backup'): boolean {
  const perms = ROLE_PERMISSIONS[role as UserRole]
  if (!perms) return false
  return perms[action]
}

// ====== Middleware: التحقق من تسجيل الدخول + الصلاحية ======
export async function requireAuth(action: 'create' | 'read' | 'update' | 'delete' | 'manageUsers' | 'manageSettings' | 'backup' = 'read') {
  const user = await getCurrentUser()
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 }),
    }
  }

  if (!hasPermission(user.role, action)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'ليس لديك صلاحية لهذا الإجراء' }, { status: 403 }),
    }
  }

  return {
    authorized: true,
    user,
    companyId: user.companyId,
  }
}

// ====== Helper: إضافة companyId لفلترة البيانات ======
export function withCompanyScope(where: Record<string, any>, companyId: string): Record<string, any> {
  return { ...where, companyId }
}
