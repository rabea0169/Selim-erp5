import { getDB, nowISO } from '../connection'
import type { FactorySettings } from '../types'

const SETTINGS_ID = 'singleton'

const DEFAULT_SETTINGS: FactorySettings = {
  id: SETTINGS_ID,
  factoryName: 'مصنع الملابس',
  factoryNameEn: 'Clothing Factory',
  slogan: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  taxNumber: '',
  commercialRegister: '',
  logo: '',
  currency: 'ج.م',
  invoicePrefix: 'INV-',
  invoiceFooter: 'شكراً لتعاملكم معنا',
  defaultPaperSize: 'A4',
  updatedAt: '',
}

class FactorySettingsRepository {
  async get(): Promise<FactorySettings> {
    const db = await getDB()
    const settings = await db.get('factorySettings', SETTINGS_ID)
    if (!settings) {
      // إنشاء الإعدادات الافتراضية لو مش موجودة
      const defaults = { ...DEFAULT_SETTINGS, updatedAt: nowISO() }
      await db.put('factorySettings', defaults)
      return defaults
    }
    return settings
  }

  async update(data: Partial<FactorySettings>): Promise<FactorySettings> {
    const db = await getDB()
    const current = await this.get()
    const updated: FactorySettings = {
      ...current,
      ...data,
      id: SETTINGS_ID,
      updatedAt: nowISO(),
    }
    await db.put('factorySettings', updated)
    return updated
  }

  async updateLogo(logoBase64: string): Promise<void> {
    await this.update({ logo: logoBase64 })
  }

  async reset(): Promise<FactorySettings> {
    const db = await getDB()
    const defaults = { ...DEFAULT_SETTINGS, updatedAt: nowISO() }
    await db.put('factorySettings', defaults)
    return defaults
  }
}

export const factorySettingsRepository = new FactorySettingsRepository()
