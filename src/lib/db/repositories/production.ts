'use client'

import { BaseRepository } from './base'
import { apiGet, apiPost } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { Production } from '../types'

/**
 * Production repository — API-based.
 * GET /api/production returns { production: [...], pagination: {...} }
 */
class ProductionRepository extends BaseRepository<Production> {
  constructor() {
    super('/api/production', 'production', 'production')
  }

  /** Get all production records for a specific worker */
  async getByWorker(workerId: string): Promise<Production[]> {
    const res: any = await apiGet('/api/production', { workerId })
    if (Array.isArray(res)) return res as Production[]
    if (res?.production) return res.production as Production[]
    for (const key of Object.keys(res || {})) {
      if (key === 'pagination') continue
      if (Array.isArray(res[key])) return res[key] as Production[]
    }
    return []
  }

  /** Get production records within a date range, optionally filtered by worker */
  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<Production[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    if (workerId) params.workerId = workerId

    const res: any = await apiGet('/api/production', params)
    if (Array.isArray(res)) return res as Production[]
    if (res?.production) return res.production as Production[]
    for (const key of Object.keys(res || {})) {
      if (key === 'pagination') continue
      if (Array.isArray(res[key])) return res[key] as Production[]
    }
    return []
  }

  /** Create a production record — server handles stock update */
  async createWithCalculation(data: any): Promise<Production> {
    const res: any = await apiPost('/api/production', data)
    dataChangeEmitter.notifyCreate('production')
    // فك تغليف الاستجابة — السيرفر يعيد { production }
    return (res?.production || res) as Production
  }
}

const productionRepository = new ProductionRepository()

export { productionRepository }
