import { describe, it, expect, afterEach } from 'vitest'
import { isContactsPickerSupported, pickContactFromPhone } from '@/lib/contacts'

const globalWithNavigator = globalThis as { navigator?: unknown }
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
  })
}

function setContactsPicker(select: (...args: unknown[]) => unknown) {
  setNavigator({ contacts: { select } })
}

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator)
  } else {
    delete globalWithNavigator.navigator
  }
})

describe('isContactsPickerSupported', () => {
  it('is false when navigator has no contacts API', () => {
    setNavigator({})
    expect(isContactsPickerSupported()).toBe(false)
  })

  it('is false when contacts exists but select is not callable', () => {
    setNavigator({ contacts: {} })
    expect(isContactsPickerSupported()).toBe(false)
  })

  it('is true when the picker is available', () => {
    setContactsPicker(async () => [])
    expect(isContactsPickerSupported()).toBe(true)
  })
})

describe('pickContactFromPhone', () => {
  it('throws a helpful error when the picker is unsupported', async () => {
    setNavigator({})
    await expect(pickContactFromPhone()).rejects.toThrow(/لا يدعم اختيار جهات الاتصال/)
  })

  it('requests name and tel for a single contact', async () => {
    const calls: unknown[][] = []
    setContactsPicker(async (...args: unknown[]) => {
      calls.push(args)
      return [{ name: ['أحمد'], tel: ['01000000000'] }]
    })

    await pickContactFromPhone()
    expect(calls[0][0]).toEqual(['name', 'tel'])
    expect(calls[0][1]).toEqual({ multiple: false })
  })

  it('returns the first name and phone from array fields, trimmed', async () => {
    setContactsPicker(async () => [{ name: ['  أحمد  ', 'آخر'], tel: [' 01000000000 '] }])
    await expect(pickContactFromPhone()).resolves.toEqual({
      name: 'أحمد',
      phone: '01000000000',
    })
  })

  it('supports scalar name and tel fields', async () => {
    setContactsPicker(async () => [{ name: 'سارة', tel: '01111111111' }])
    await expect(pickContactFromPhone()).resolves.toEqual({
      name: 'سارة',
      phone: '01111111111',
    })
  })

  it('falls back to empty strings for missing fields', async () => {
    setContactsPicker(async () => [{ name: [], tel: [] }])
    await expect(pickContactFromPhone()).resolves.toEqual({ name: '', phone: '' })
  })

  it('returns null when the user picks nothing', async () => {
    setContactsPicker(async () => [])
    await expect(pickContactFromPhone()).resolves.toBeNull()

    setContactsPicker(async () => null)
    await expect(pickContactFromPhone()).resolves.toBeNull()
  })

  it('returns null when the picker is aborted or blocked', async () => {
    for (const name of ['AbortError', 'SecurityError']) {
      setContactsPicker(async () => {
        const err = new Error('rejected')
        err.name = name
        throw err
      })
      await expect(pickContactFromPhone()).resolves.toBeNull()
    }
  })

  it('rethrows unexpected picker errors', async () => {
    setContactsPicker(async () => {
      throw new Error('boom')
    })
    await expect(pickContactFromPhone()).rejects.toThrow('boom')
  })
})
