import { describe, it, expect, vi, afterEach } from 'vitest'
import { combineDateTime, currentTimeStr, timeFromISO } from '../helpers'

afterEach(() => {
  vi.useRealTimers()
})

describe('currentTimeStr', () => {
  it('returns the local time zero-padded as HH:MM', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 15, 9, 5))
    expect(currentTimeStr()).toBe('09:05')
  })

  it('uses 24 hour notation', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 15, 23, 59))
    expect(currentTimeStr()).toBe('23:59')
  })
})

describe('timeFromISO', () => {
  it('returns an empty string for null input', () => {
    expect(timeFromISO(null)).toBe('')
  })

  it('extracts the local time from an ISO timestamp', () => {
    const iso = new Date(2024, 0, 15, 7, 4).toISOString()
    expect(timeFromISO(iso)).toBe('07:04')
  })
})

describe('combineDateTime', () => {
  it('merges a date string with an HH:MM time', () => {
    const result = combineDateTime('2024-01-15', '13:45')
    const parsed = new Date(result)
    expect(parsed.getHours()).toBe(13)
    expect(parsed.getMinutes()).toBe(45)
    expect(parsed.getSeconds()).toBe(0)
  })

  it('round-trips through timeFromISO', () => {
    expect(timeFromISO(combineDateTime('2024-01-15', '08:30'))).toBe('08:30')
  })
})
