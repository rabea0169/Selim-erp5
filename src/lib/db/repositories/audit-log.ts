'use client'

import type { AuditLogEntry } from '../types'

/**
 * Audit log repository — no-op stub for server mode.
 * The server handles audit logging internally; the client does not
 * need to read or write audit logs directly.
 */
const auditLogRepository = {
  /** Log an entry — server handles this automatically */
  async log(_entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    // No-op: audit logging is handled server-side
  },

  /** Get all audit log entries */
  async getAll(_limit?: number): Promise<AuditLogEntry[]> {
    // No dedicated audit log API endpoint
    return []
  },

  /** Get audit log entries for a specific entity */
  async getByEntity(_type: string, _id?: string): Promise<AuditLogEntry[]> {
    return []
  },

  /** Clear all audit logs */
  async clear(): Promise<void> {
    // No-op: server manages audit log retention
  },
}

export { auditLogRepository }
