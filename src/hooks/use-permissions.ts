'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getCurrentUser } from '@/lib/db'
import { hasPermission, type UserRole } from '@/lib/permissions'

type PermissionKey = 'create' | 'update' | 'delete' | 'manageUsers' | 'manageSettings' | 'backup'

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  manageUsers: 'إدارة المستخدمين',
  manageSettings: 'إدارة الإعدادات',
  backup: 'النسخ الاحتياطي',
}

const KEY_TO_PROP: Record<PermissionKey, string> = {
  create: 'canCreate',
  update: 'canUpdate',
  delete: 'canDelete',
  manageUsers: 'canManageUsers',
  manageSettings: 'canManageSettings',
  backup: 'canBackup',
}

// ====== usePermissions ======

export function usePermissions() {
  const user = useMemo(() => getCurrentUser(), [])
  const role = (user?.role ?? 'viewer') as UserRole

  const canCreate = hasPermission(role, 'create')
  const canUpdate = hasPermission(role, 'update')
  const canDelete = hasPermission(role, 'delete')
  const canManageUsers = hasPermission(role, 'manageUsers')
  const canManageSettings = hasPermission(role, 'manageSettings')
  const canBackup = hasPermission(role, 'backup')

  return {
    canCreate,
    canUpdate,
    canDelete,
    canManageUsers,
    canManageSettings,
    canBackup,
    role,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isEmployee: role === 'employee',
    isViewer: role === 'viewer',
  }
}

// ====== PermissionGate ======

interface PermissionGateProps {
  permission: PermissionKey
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const perms = usePermissions()
  const allowed = (perms as Record<string, boolean>)[KEY_TO_PROP[permission]]

  return <>{allowed ? children : fallback}</>
}

// ====== useRequirePermission ======

export function useRequirePermission(permission: PermissionKey) {
  const perms = usePermissions()
  const { toast } = useToast()
  const allowed = (perms as Record<string, boolean>)[KEY_TO_PROP[permission]]

  const require = (): boolean => {
    if (!allowed) {
      toast({ title: 'صلاحية مرفوضة', description: `ليس لديك صلاحية ${PERMISSION_LABELS[permission]}`, variant: 'destructive' })
      return false
    }
    return true
  }

  return { allowed, require }
}
