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

// ====== التحقق من الصلاحية (pure function - safe for client) ======
export function hasPermission(role: string, action: 'create' | 'read' | 'update' | 'delete' | 'manageUsers' | 'manageSettings' | 'backup'): boolean {
  const perms = ROLE_PERMISSIONS[role as UserRole]
  if (!perms) return false
  return perms[action]
}

// ====== Helper: إضافة companyId لفلترة البيانات (safe for client) ======
export function withCompanyScope(where: Record<string, any>, companyId: string): Record<string, any> {
  return { ...where, companyId }
}
