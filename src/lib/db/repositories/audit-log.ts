// Audit log - الآن يتم التعامل معه من السيرفر فقط
export const auditLogRepository = {
  // التسجيل غير حرج: لا نوقف العملية عند فشله، لكن نسجّل الخطأ في الـ console
  log: async (data: { userId: string; userName: string; action: string; entityType: string; description: string }) => {
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        console.warn(`[audit] فشل تسجيل العملية (${res.status}):`, data.action)
      }
    } catch (e) {
      console.warn('[audit] تعذر إرسال سجل العملية:', e)
    }
  },
}
