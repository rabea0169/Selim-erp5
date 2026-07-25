"use client"

import { useMemo } from 'react'
import { ROLE_PERMISSIONS, type UserRole } from '@/lib/permissions'

export interface Permissions {
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
  canManageUsers: boolean
  canManageSettings: boolean
  canBackup: boolean
  isOwner: boolean
  isAdmin: boolean
  isManager: boolean
  isEmployee: boolean
  isViewer: boolean
}

const EMPTY: Permissions = {
  canCreate: false, canRead: false, canUpdate: false, canDelete: false,
  canManageUsers: false, canManageSettings: false, canBackup: false,
  isOwner: false, isAdmin: false, isManager: false, isEmployee: false, isViewer: false,
}

export function usePermissions(role?: string): Permissions {
  return useMemo(() => {
    if (!role) return EMPTY
    const p = ROLE_PERMISSIONS[role as UserRole]
    if (!p) return EMPTY
    return {
      canCreate: p.create,
      canRead: p.read,
      canUpdate: p.update,
      canDelete: p.delete,
      canManageUsers: p.manageUsers,
      canManageSettings: p.manageSettings,
      canBackup: p.backup,
      isOwner: role === 'owner',
      isAdmin: role === 'admin',
      isManager: role === 'manager',
      isEmployee: role === 'employee',
      isViewer: role === 'viewer',
    }
  }, [role])
}