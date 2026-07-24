// دوال مساعدة لنظام الحضور والانصراف

export interface Worker {
  id: string
  name: string
  job: string | null
  type: string
  // إعدادات الساعات (للنوع hourly و monthly)
  workStartTime?: string | null
  workHoursPerDay?: number | null
  hourlyRate?: number | null
  overtimeRate?: number | null
  monthlySalary?: number | null
}

export interface Attendance {
  id: string
  workerId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  notes: string | null
  worker: Worker
  // حقول محسوبة (تُخزن عند الحفظ)
  workHours?: number | null
  overtimeHours?: number | null
  lateMinutes?: number | null
}

/**
 * الحصول على الوقت الحالي بصيغة HH:MM
 */
export function currentTimeStr(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * استخراج الوقت بصيغة HH:MM من تاريخ ISO
 */
export function timeFromISO(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * دمج التاريخ والوقت في ISO
 */
export function combineDateTime(dateStr: string, timeStr: string): string {
  const d = new Date(dateStr)
  const [h, m] = timeStr.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
