import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  startOfMonth,
  todayStr,
} from '@/lib/format'

// تحويل الأرقام العربية الهندية إلى ASCII حتى تعمل التوقعات مهما كان إعداد ICU
function toAsciiDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u066b\u002c\u066c\u2066\u2067\u2069\u200f]/g, (c) =>
      c === '\u066b' ? '.' : c === '\u066c' ? ',' : c === '\u002c' ? ',' : ''
    )
}

describe('formatCurrency', () => {
  it('formats a number with two decimals and the EGP suffix', () => {
    expect(toAsciiDigits(formatCurrency(1234.5))).toContain('1,234.50')
    expect(formatCurrency(1234.5).endsWith('ج.م')).toBe(true)
  })

  it('rounds to two decimals', () => {
    expect(toAsciiDigits(formatCurrency(0.129))).toContain('0.13')
  })

  it('falls back to zero for NaN and nullish input', () => {
    expect(toAsciiDigits(formatCurrency(NaN))).toContain('0.00')
    expect(toAsciiDigits(formatCurrency(undefined as unknown as number))).toContain('0.00')
  })

  it('keeps the sign of negative amounts', () => {
    expect(toAsciiDigits(formatCurrency(-5))).toContain('5.00')
    expect(formatCurrency(-5)).toMatch(/-|\u061c/)
  })
})

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(toAsciiDigits(formatNumber(1000000))).toContain('1,000,000')
  })

  it('falls back to zero for invalid input', () => {
    expect(toAsciiDigits(formatNumber(NaN))).toContain('0')
    expect(toAsciiDigits(formatNumber(null as unknown as number))).toContain('0')
  })
})

describe('formatDate / formatDateTime', () => {
  it('accepts both Date objects and ISO strings', () => {
    const date = new Date(2024, 0, 15, 13, 45)
    expect(formatDate(date)).toBe(formatDate(date.toISOString()))
    expect(formatDateTime(date)).toBe(formatDateTime(date.toISOString()))
  })

  it('renders day, month and year parts of the date', () => {
    const formatted = toAsciiDigits(formatDate(new Date(2024, 0, 15)))
    expect(formatted).toContain('15')
    expect(formatted).toContain('01')
    expect(formatted).toContain('2024')
  })

  it('includes the time in formatDateTime', () => {
    const formatted = toAsciiDigits(formatDateTime(new Date(2024, 0, 15, 13, 45)))
    expect(formatted).toContain('45')
    expect(formatted.length).toBeGreaterThan(toAsciiDigits(formatDate(new Date(2024, 0, 15))).length)
  })
})

describe('todayStr / startOfMonth', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the local date as yyyy-mm-dd', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 2, 9, 23, 30))
    expect(todayStr()).toBe('2024-03-09')
  })

  it('returns the first day of the current month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 8, 24, 10, 0))
    expect(startOfMonth()).toBe('2024-09-01')
  })
})
