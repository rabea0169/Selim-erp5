import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('px-2', 'text-sm')).toBe('px-2 text-sm')
  })

  it('drops falsy values and supports conditional objects', () => {
    expect(cn('px-2', false && 'hidden', undefined, { 'text-red-500': true, 'text-blue-500': false }))
      .toBe('px-2 text-red-500')
  })

  it('lets later tailwind classes win over conflicting earlier ones', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-sm text-muted-foreground', 'text-lg')).toBe('text-muted-foreground text-lg')
  })
})
