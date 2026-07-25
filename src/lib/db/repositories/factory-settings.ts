import type { FactorySettings } from '../types'
import { apiFetch } from '../api-client'

class FactorySettingsRepository {
  async get(): Promise<FactorySettings | null> {
    const data = await apiFetch<{ settings?: FactorySettings }>('/api/seed')
    return data.settings || null
  }

  async update(data: Partial<FactorySettings>): Promise<FactorySettings> {
    const result = await apiFetch<{ settings: FactorySettings }>('/api/seed', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return result.settings
  }
}

export const factorySettingsRepository = new FactorySettingsRepository()
