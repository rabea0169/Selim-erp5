import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'

/**
 * تسجيل حركة في سجل التدقيق (AuditLog) على السيرفر
 */
export async function logAudit(data: {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'RESTORE' | 'BACKUP'
  entityType: string
  entityId?: string | null
  description: string
  metadata?: Record<string, unknown>
}) {
  try {
    const user = await getCurrentUser()
    if (!user) return
    await db.auditLog.create({
      data: {
        companyId: user.companyId || null,
        userId: user.id,
        userName: user.name || user.username,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId || null,
        description: data.description,
        metadata: data.metadata ? (data.metadata as any) : undefined,
      },
    })
  } catch (e) {
    console.error('[AuditLog] Failed to record log:', e)
  }
}
