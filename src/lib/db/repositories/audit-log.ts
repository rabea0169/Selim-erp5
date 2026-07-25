// Audit log - الآن يتم التعامل معه من السيرفر فقط
export const auditLogRepository = {
  log: async (_data: { userId: string; userName: string; action: string; entityType: string; description: string }) => {
    // السيرفر يسجل العمليات تلقائياً
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_data),
      }).catch(() => {})
    } catch {}
  },
}
