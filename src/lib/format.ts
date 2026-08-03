// دوال مساعدة عامة للنظام

// تنسيق العملة بالجنيه المصري
export function formatCurrency(amount: number, currency?: string): string {
  const formatted = new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0)
  const suffix = currency || 'ج.م'
  return `${formatted} ${suffix}`
}

// تنسيق التاريخ بالعربي
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// التاريخ الحالي بصيغة yyyy-mm-dd
export function todayStr(): string {
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60000
  const local = new Date(d.getTime() - offset)
  return local.toISOString().split('T')[0]
}

// أول الشهر الحالي
export function startOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// تنسيق رقم
export function formatNumber(num: number): string {
  return (Number(num) || 0).toLocaleString('ar-EG')
}
