import { describe, it, expect } from 'vitest'
import {
  calculateAttendance,
  calculateHours,
  calculateLateMinutes,
  calculateWorkerHours,
  formatHours,
  formatMinutes,
} from '@/lib/attendance-calc'
import type { Worker, WorkerAttendance } from '@/lib/db/types'

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: 'w1',
    name: 'أحمد',
    type: 'hourly',
    hourlyRate: 10,
    workStartTime: '08:00',
    workHoursPerDay: 8,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeAttendance(overrides: Partial<WorkerAttendance> = {}): WorkerAttendance {
  return {
    id: 'a1',
    workerId: 'w1',
    date: '2024-01-15',
    checkIn: '2024-01-15T08:00:00',
    checkOut: '2024-01-15T16:00:00',
    status: 'present',
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2024-01-15T16:00:00.000Z',
    ...overrides,
  } as WorkerAttendance
}

describe('calculateHours', () => {
  it('returns the difference between check-in and check-out', () => {
    expect(calculateHours('2024-01-15T08:00:00', '2024-01-15T16:30:00')).toBe(8.5)
  })

  it('wraps around midnight when check-out is earlier than check-in', () => {
    expect(calculateHours('2024-01-15T22:00:00', '2024-01-15T06:00:00')).toBe(8)
  })

  it('returns zero for identical timestamps', () => {
    expect(calculateHours('2024-01-15T08:00:00', '2024-01-15T08:00:00')).toBe(0)
  })
})

describe('calculateLateMinutes', () => {
  it('returns zero when no shift start time is configured', () => {
    expect(calculateLateMinutes('2024-01-15T10:00:00')).toBe(0)
  })

  it('returns zero when the worker arrives early or on time', () => {
    expect(calculateLateMinutes('2024-01-15T07:30:00', '08:00')).toBe(0)
    expect(calculateLateMinutes('2024-01-15T08:00:00', '08:00')).toBe(0)
  })

  it('counts whole minutes of lateness', () => {
    expect(calculateLateMinutes('2024-01-15T08:25:30', '08:00')).toBe(25)
    expect(calculateLateMinutes('2024-01-15T09:05:00', '08:00')).toBe(65)
  })
})

describe('calculateAttendance', () => {
  it('returns an empty calculation when check-in or check-out is missing', () => {
    const empty = calculateAttendance(makeAttendance({ checkOut: undefined }), makeWorker())
    expect(empty.workHours).toBe(0)
    expect(empty.totalPay).toBe(0)
  })

  it('returns an empty calculation for non-present statuses', () => {
    const absent = calculateAttendance(makeAttendance({ status: 'absent' }), makeWorker())
    expect(absent).toEqual({
      workHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      lateMinutes: 0,
      regularPay: 0,
      overtimePay: 0,
      totalPay: 0,
    })
  })

  it('pays only regular hours for a full standard day', () => {
    const calc = calculateAttendance(makeAttendance(), makeWorker())
    expect(calc).toEqual({
      workHours: 8,
      regularHours: 8,
      overtimeHours: 0,
      lateMinutes: 0,
      regularPay: 80,
      overtimePay: 0,
      totalPay: 80,
    })
  })

  it('pays overtime at the configured overtime rate', () => {
    const calc = calculateAttendance(
      makeAttendance({ checkOut: '2024-01-15T18:00:00' }),
      makeWorker({ overtimeRate: 20 })
    )
    expect(calc.overtimeHours).toBe(2)
    expect(calc.overtimePay).toBe(40)
    expect(calc.totalPay).toBe(120)
  })

  it('defaults the overtime rate to 1.5x the hourly rate', () => {
    const calc = calculateAttendance(
      makeAttendance({ checkOut: '2024-01-15T18:00:00' }),
      makeWorker()
    )
    expect(calc.overtimePay).toBe(30)
    expect(calc.totalPay).toBe(110)
  })

  it('caps regular hours for a short day and reports lateness', () => {
    const calc = calculateAttendance(
      makeAttendance({ checkIn: '2024-01-15T08:30:00', checkOut: '2024-01-15T12:30:00' }),
      makeWorker()
    )
    expect(calc.workHours).toBe(4)
    expect(calc.regularHours).toBe(4)
    expect(calc.overtimeHours).toBe(0)
    expect(calc.lateMinutes).toBe(30)
    expect(calc.totalPay).toBe(40)
  })

  it('falls back to an 8 hour day and a zero rate when the worker has no settings', () => {
    const calc = calculateAttendance(
      makeAttendance({ checkOut: '2024-01-15T20:00:00' }),
      makeWorker({ hourlyRate: undefined, workHoursPerDay: undefined, workStartTime: undefined })
    )
    expect(calc.workHours).toBe(12)
    expect(calc.regularHours).toBe(8)
    expect(calc.overtimeHours).toBe(4)
    expect(calc.totalPay).toBe(0)
    expect(calc.lateMinutes).toBe(0)
  })

  it('rounds monetary and hour values to two decimals', () => {
    const calc = calculateAttendance(
      makeAttendance({ checkOut: '2024-01-15T16:20:00' }),
      makeWorker({ hourlyRate: 3.33 })
    )
    expect(calc.workHours).toBe(8.33)
    expect(calc.overtimeHours).toBe(0.33)
    expect(calc.totalPay).toBe(28.31)
  })
})

describe('calculateWorkerHours', () => {
  it('aggregates only present days', () => {
    const worker = makeWorker({ overtimeRate: 20 })
    const totals = calculateWorkerHours(
      [
        makeAttendance(),
        makeAttendance({ id: 'a2', checkOut: '2024-01-16T18:00:00', checkIn: '2024-01-16T08:30:00' }),
        makeAttendance({ id: 'a3', status: 'absent' }),
      ],
      worker
    )

    expect(totals.presentDays).toBe(2)
    expect(totals.totalWorkHours).toBe(17.5)
    expect(totals.totalOvertimeHours).toBe(1.5)
    expect(totals.totalLateMinutes).toBe(30)
    expect(totals.totalRegularPay).toBe(160)
    expect(totals.totalOvertimePay).toBe(30)
    expect(totals.totalPay).toBe(190)
  })

  it('returns zeroed totals for an empty list', () => {
    const totals = calculateWorkerHours([], makeWorker())
    expect(totals).toEqual({
      totalWorkHours: 0,
      totalOvertimeHours: 0,
      totalLateMinutes: 0,
      totalRegularPay: 0,
      totalOvertimePay: 0,
      totalPay: 0,
      presentDays: 0,
    })
  })
})

describe('formatHours', () => {
  it('omits minutes for whole hours', () => {
    expect(formatHours(3)).toBe('3 ساعة')
  })

  it('renders hours and minutes', () => {
    expect(formatHours(2.5)).toBe('2 ساعة و 30 دقيقة')
  })
})

describe('formatMinutes', () => {
  it('reports on-time for zero minutes', () => {
    expect(formatMinutes(0)).toBe('في الوقت')
  })

  it('renders minutes only below an hour', () => {
    expect(formatMinutes(45)).toBe('45 دقيقة')
  })

  it('renders hours and minutes above an hour', () => {
    expect(formatMinutes(95)).toBe('1 ساعة و 35 دقيقة')
  })
})
