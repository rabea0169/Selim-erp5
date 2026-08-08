import { db } from '@/lib/db-server'
import { PermissionAction } from '@prisma/client'

/**
 * التحقق من وجود صلاحية معينة للمستخدم
 */
export async function checkPermission(
  userId: string,
  resource: string,
  action: PermissionAction
): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) return false

    // الـ owner و admin لديهم جميع الصلاحيات
    if (user.role === 'owner' || user.role === 'admin') {
      return true
    }

    // البحث عن الصلاحية المحددة
    const permission = await db.userPermission.findFirst({
      where: {
        userId,
        resource,
        action,
      },
    })

    return !!permission
  } catch (error) {
    console.error('Error checking permission:', error)
    return false
  }
}

/**
 * الحصول على جميع صلاحيات المستخدم
 */
export async function getUserPermissions(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        permissions: true,
      },
    })

    if (!user) return []

    // الـ owner و admin لديهم جميع الصلاحيات
    if (user.role === 'owner' || user.role === 'admin') {
      return [
        { resource: '*', action: '*', canViewAll: true, canEditOwn: true },
      ]
    }

    return user.permissions || []
  } catch (error) {
    console.error('Error getting user permissions:', error)
    return []
  }
}

/**
 * إضافة صلاحية للمستخدم
 */
export async function grantPermission(
  userId: string,
  resource: string,
  action: PermissionAction,
  options?: { canViewAll?: boolean; canEditOwn?: boolean }
) {
  try {
    const permission = await db.userPermission.upsert({
      where: {
        userId_resource_action: {
          userId,
          resource,
          action,
        },
      },
      update: {
        canViewAll: options?.canViewAll ?? false,
        canEditOwn: options?.canEditOwn ?? false,
      },
      create: {
        userId,
        resource,
        action,
        canViewAll: options?.canViewAll ?? false,
        canEditOwn: options?.canEditOwn ?? false,
      },
    })

    return permission
  } catch (error) {
    console.error('Error granting permission:', error)
    throw error
  }
}

/**
 * إزالة صلاحية من المستخدم
 */
export async function revokePermission(
  userId: string,
  resource: string,
  action: PermissionAction
) {
  try {
    await db.userPermission.deleteMany({
      where: {
        userId,
        resource,
        action,
      },
    })
  } catch (error) {
    console.error('Error revoking permission:', error)
    throw error
  }
}

/**
 * تطبيق قالب دور على مستخدم
 */
export async function applyRoleTemplate(userId: string, roleTemplateName: string) {
  try {
    const roleTemplate = await db.roleTemplate.findUnique({
      where: { name: roleTemplateName },
    })

    if (!roleTemplate) {
      throw new Error(`قالب الدور "${roleTemplateName}" غير موجود`)
    }

    const permissions = roleTemplate.permissions as Array<{
      resource: string
      action: PermissionAction
      canViewAll?: boolean
      canEditOwn?: boolean
    }>

    // حذف الصلاحيات القديمة
    await db.userPermission.deleteMany({
      where: { userId },
    })

    // إضافة الصلاحيات الجديدة
    for (const perm of permissions) {
      await grantPermission(userId, perm.resource, perm.action, {
        canViewAll: perm.canViewAll,
        canEditOwn: perm.canEditOwn,
      })
    }
  } catch (error) {
    console.error('Error applying role template:', error)
    throw error
  }
}

/**
 * إنشاء قالب دور جديد
 */
export async function createRoleTemplate(
  name: string,
  description: string,
  permissions: Array<{
    resource: string
    action: PermissionAction
    canViewAll?: boolean
    canEditOwn?: boolean
  }>
) {
  try {
    const roleTemplate = await db.roleTemplate.create({
      data: {
        name,
        description,
        permissions,
      },
    })

    return roleTemplate
  } catch (error) {
    console.error('Error creating role template:', error)
    throw error
  }
}

/**
 * قوالب الأدوار المسبقة
 */
export const DEFAULT_ROLE_TEMPLATES = {
  SALES_MANAGER: {
    name: 'مدير المبيعات',
    permissions: [
      { resource: 'sales', action: 'CREATE' as PermissionAction },
      { resource: 'sales', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'sales', action: 'UPDATE' as PermissionAction },
      { resource: 'sales', action: 'EXPORT' as PermissionAction },
      { resource: 'customers', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'payments', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'reports', action: 'READ' as PermissionAction },
    ],
  },
  ACCOUNTANT: {
    name: 'محاسب',
    permissions: [
      { resource: 'sales', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'purchases', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'payments', action: 'CREATE' as PermissionAction },
      { resource: 'payments', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'payments', action: 'UPDATE' as PermissionAction },
      { resource: 'reports', action: 'READ' as PermissionAction },
      { resource: 'reports', action: 'EXPORT' as PermissionAction },
    ],
  },
  WAREHOUSE_MANAGER: {
    name: 'مدير المستودع',
    permissions: [
      { resource: 'inventory', action: 'CREATE' as PermissionAction },
      { resource: 'inventory', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'inventory', action: 'UPDATE' as PermissionAction },
      { resource: 'materials', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'products', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'reports', action: 'READ' as PermissionAction },
    ],
  },
  VIEWER: {
    name: 'مشاهد',
    permissions: [
      { resource: 'sales', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'purchases', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'inventory', action: 'READ' as PermissionAction, canViewAll: true },
      { resource: 'reports', action: 'READ' as PermissionAction },
    ],
  },
}
