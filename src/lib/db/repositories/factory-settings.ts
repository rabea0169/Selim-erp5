'use client'

import { apiGet, apiPut } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { FactorySettings } from '../types'

/** Default factory settings used for reset */
const DEFAULT_SETTINGS: Omit<FactorySettings, 'id' | 'updatedAt'> = {
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
  invoicePrefix: '',
  invoiceFooter: '',
  defaultPaperSize: 'a4',
}

/**
 * Factory settings repository — singleton API-based pattern.
 * GET /api/factory-settings returns the settings object directly.
 */
const factorySettingsRepository = {
  /** Get the current factory settings */
  async get(): Promise<FactorySettings> {
    return await apiGet<FactorySettings>('/api/factory-settings')
  },

  /** Update factory settings (partial or full) */
  async update(data: Partial<FactorySettings>): Promise<FactorySettings> {
    const result = await apiPut<FactorySettings>('/api/factory-settings', data)
    dataChangeEmitter.notifyUpdate('factorySettings')
    return result
  },

  /** Update only the logo */
  async updateLogo(logoBase64: string): Promise<FactorySettings> {
    const result = await apiPut<FactorySettings>('/api/factory-settings', { logo: logoBase64 })
    dataChangeEmitter.notifyUpdate('factorySettings')
    return result
  },

  /** Reset all settings to defaults */
  async reset(): Promise<FactorySettings> {
    const result = await apiPut<FactorySettings>('/api/factory-settings', {
      ...DEFAULT_SETTINGS,
    })
    dataChangeEmitter.notifyUpdate('factorySettings')
    return result
  },
}

export { factorySettingsRepository }
