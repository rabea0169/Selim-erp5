'use client'

import { getDB, generateId, nowISO } from '../connection'
import type { AuditLogEntry } from '../types'

export type { AuditLogEntry }

class AuditLogRepository {
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const db = await getDB()
      const logEntry: AuditLogEntry = {
        ...entry,
        id: generateId(),
        timestamp: nowISO(),
      }
      await db.add('auditLogs', logEntry)
    } catch (e) {
      console.error('Failed to log audit:', e)
    }
  }

  async getAll(limit: number = 100): Promise<AuditLogEntry[]> {
    const db = await getDB()
    const all = await db.getAll('auditLogs')
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit)
  }

  async getByEntity(entityType: string, entityId?: string): Promise<AuditLogEntry[]> {
    const all = await this.getAll(1000)
    return all.filter((log) => {
      if (log.entityType !== entityType) return false
      if (entityId && log.entityId !== entityId) return false
      return true
    })
  }

  async clear(): Promise<void> {
    const db = await getDB()
    await db.clear('auditLogs')
  }
}

export const auditLogRepository = new AuditLogRepository()
