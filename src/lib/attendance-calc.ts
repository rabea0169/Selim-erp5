import type { Worker, WorkerAttendance } from '@/lib/db/types'

/**
 * حساب ساعات العمل، الإضافي، والتأخير من الحضور والانصراف
 */
export interface AttendanceCalculation {
  workHours: number        // إجمالي ساعات العمل
  regularHours: number     // الساعات العادية
  overtimeHours: number    // الساعات الإضافية
  lateMinutes: number      // دقائق التأخير
  regularPay: number       // أجر الساعات العادية
  overtimePay: number      // أجر الساعات الإضافية
  totalPay: number         // الإجمالي المستحق
}

/**
 * حساب الفرق بين وقتين بالساعات (مع دعم عبور منتصف الليل)
 */
export function calculateHours(checkIn: string, checkOut: string): number {
  const inTime = new Date(checkIn)
  const outTime = new Date(checkOut)

  let diffMs = outTime.getTime() - inTime.getTime()
  if (diffMs < 0) {
    // لو الانصراف قبل الحضور (يعني عبّر منتصف الليل)
    diffMs += 24 * 60 * 60 * 1000
  }

  return diffMs / (1000 * 60 * 60) // تحويل لساعات
}

/**
 * حساب دقائق التأخير عن وقت بدء العمل
 */
export function calculateLateMinutes(
  checkIn: string,
  workStartTime?: string
): number {
  if (!workStartTime) return 0

  const inTime = new Date(checkIn)
  const [startH, startM] = workStartTime.split(':').map(Number)
  const expectedTime = new Date(inTime)
  expectedTime.setHours(startH, startM, 0, 0)

  let diffMs = inTime.getTime() - expectedTime.getTime()
  if (diffMs < 0) return 0 // حضر مبكراً

  return Math.floor(diffMs / (1000 * 60)) // دقائق
}

/**
 * الحساب الكامل للحضور والانصراف
 */
export function calculateAttendance(
  attendance: WorkerAttendance,
  worker: Worker
): AttendanceCalculation {
  const empty: AttendanceCalculation = {
    workHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    lateMinutes: 0,
    regularPay: 0,
    overtimePay: 0,
    totalPay: 0,
  }

  if (!attendance.checkIn || !attendance.checkOut) return empty
  if (attendance.status !== 'present') return empty

  const workHours = calculateHours(attendance.checkIn, attendance.checkOut)
  const lateMinutes = calculateLateMinutes(attendance.checkIn, worker.workStartTime)
  const requiredHours = worker.workHoursPerDay || 8

  // الساعات العادية = الحد الأدنى من (ساعات العمل، الساعات المطلوبة)
  const regularHours = Math.min(workHours, requiredHours)
  // الساعات الإضافية = ما يزيد عن المطلوب
  const overtimeHours = Math.max(0, workHours - requiredHours)

  // الحساب المالي
  const hourlyRate = worker.hourlyRate || 0
  const overtimeRate = worker.overtimeRate || (hourlyRate * 1.5) // افتراضي 1.5x

  const regularPay = regularHours * hourlyRate
  const overtimePay = overtimeHours * overtimeRate
  const totalPay = regularPay + overtimePay

  return {
    workHours: Math.round(workHours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    lateMinutes,
    regularPay: Math.round(regularPay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    totalPay: Math.round(totalPay * 100) / 100,
  }
}

/**
 * تنسيق الساعات للعرض
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h} ساعة`
  return `${h} ساعة و ${m} دقيقة`
}

/**
 * تنسيق الدقائق للعرض
 */
export function formatMinutes(minutes: number): string {
  if (minutes === 0) return 'في الوقت'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} دقيقة`
  return `${h} ساعة و ${m} دقيقة`
}

/**
 * حساب إجمالي ساعات عمل موظف في فترة
 */
export function calculateWorkerHours(
  attendances: WorkerAttendance[],
  worker: Worker
): {
  totalWorkHours: number
  totalOvertimeHours: number
  totalLateMinutes: number
  totalRegularPay: number
  totalOvertimePay: number
  totalPay: number
  presentDays: number
} {
  let totalWorkHours = 0
  let totalOvertimeHours = 0
  let totalLateMinutes = 0
  let totalRegularPay = 0
  let totalOvertimePay = 0
  let presentDays = 0

  for (const att of attendances) {
    if (att.status !== 'present') continue
    const calc = calculateAttendance(att, worker)
    totalWorkHours += calc.workHours
    totalOvertimeHours += calc.overtimeHours
    totalLateMinutes += calc.lateMinutes
    totalRegularPay += calc.regularPay
    totalOvertimePay += calc.overtimePay
    presentDays++
  }

  return {
    totalWorkHours: Math.round(totalWorkHours * 100) / 100,
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
    totalLateMinutes,
    totalRegularPay: Math.round(totalRegularPay * 100) / 100,
    totalOvertimePay: Math.round(totalOvertimePay * 100) / 100,
    totalPay: Math.round((totalRegularPay + totalOvertimePay) * 100) / 100,
    presentDays,
  }
}
