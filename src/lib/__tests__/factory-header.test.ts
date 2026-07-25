import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FactorySettings } from '@/lib/db/types'

const get = vi.fn()
vi.mock('@/lib/db', () => ({
  factorySettingsRepository: {
    get: () => get(),
  },
}))

import {
  buildFactoryFooter,
  buildFactoryHeader,
  buildFactoryHeaderText,
  clearSettingsCache,
  getFactorySettings,
} from '@/lib/factory-header'

function makeSettings(overrides: Partial<FactorySettings> = {}): FactorySettings {
  return {
    id: 'singleton',
    factoryName: 'مصنع سليم',
    currency: 'ج.م',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  get.mockReset()
  clearSettingsCache()
})

describe('getFactorySettings', () => {
  it('caches the repository result across calls', async () => {
    const settings = makeSettings()
    get.mockResolvedValue(settings)

    expect(await getFactorySettings()).toBe(settings)
    expect(await getFactorySettings()).toBe(settings)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('refetches after the cache is cleared', async () => {
    get.mockResolvedValueOnce(makeSettings()).mockResolvedValueOnce(makeSettings({ factoryName: 'جديد' }))

    await getFactorySettings()
    clearSettingsCache()
    expect((await getFactorySettings()).factoryName).toBe('جديد')
    expect(get).toHaveBeenCalledTimes(2)
  })
})

describe('buildFactoryHeader', () => {
  it('renders only the factory name when nothing else is set', () => {
    const html = buildFactoryHeader(makeSettings())
    expect(html).toContain('مصنع سليم')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('س.ض')
    expect(html).not.toContain('📞')
  })

  it('renders the logo, contact details and registration numbers when present', () => {
    const html = buildFactoryHeader(
      makeSettings({
        logo: 'data:image/png;base64,AAA',
        factoryNameEn: 'Selim Factory',
        slogan: 'جودة',
        phone: '0100',
        address: 'القاهرة',
        email: 'a@b.com',
        taxNumber: '123',
        commercialRegister: '456',
      })
    )

    expect(html).toContain('<img src="data:image/png;base64,AAA"')
    expect(html).toContain('Selim Factory')
    expect(html).toContain('جودة')
    expect(html).toContain('0100')
    expect(html).toContain('القاهرة')
    expect(html).toContain('a@b.com')
    expect(html).toContain('س.ض: 123')
    expect(html).toContain('س.ت: 456')
  })

  it('renders the tax block when only one registration number is set', () => {
    const html = buildFactoryHeader(makeSettings({ taxNumber: '123' }))
    expect(html).toContain('س.ض: 123')
    expect(html).not.toContain('س.ت:')
  })
})

describe('buildFactoryFooter', () => {
  it('uses a default thank-you note when no footer is configured', () => {
    const html = buildFactoryFooter(makeSettings())
    expect(html).toContain('شكراً لتعاملكم معنا')
    expect(html).not.toContain('واتساب')
  })

  it('uses the configured footer and whatsapp number', () => {
    const html = buildFactoryFooter(makeSettings({ invoiceFooter: 'تحياتنا', whatsapp: '0100' }))
    expect(html).toContain('تحياتنا')
    expect(html).toContain('واتساب: 0100')
  })
})

describe('buildFactoryHeaderText', () => {
  it('joins only the non-empty lines', () => {
    expect(buildFactoryHeaderText(makeSettings())).toBe('مصنع سليم')
    expect(
      buildFactoryHeaderText(makeSettings({ slogan: 'جودة', phone: '0100', address: 'القاهرة', taxNumber: '123' }))
    ).toBe('مصنع سليم\nجودة\nهاتف: 0100\nالقاهرة\nس.ض: 123')
  })
})
