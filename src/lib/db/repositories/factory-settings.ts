import type { FactorySettings } from '../types'

async function apiFetch<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

class FactorySettingsRepository {
  async get(): Promise<FactorySettings | null> {
    try {
      const data = await apiFetch<{ settings?: FactorySettings }>('/api/seed')
      return data.settings || null
    } catch {
      return null
    }
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
