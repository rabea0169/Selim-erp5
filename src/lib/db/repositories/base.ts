'use client'

import { apiGet, apiPost, apiPut, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { EntityType } from '../live-data'

interface PaginatedResponse<T> {
  pagination?: { total: number; page: number; limit: number; pages: number }
}

/**
 * BaseRepository — generic API-based repository.
 * Replaces IndexedDB operations with server API calls.
 * Subclasses set `responseKey` to match the key used in paginated responses
 * (e.g. 'sales', 'workers', 'categories', 'transactions', etc.).
 *
 * Subclasses also pass `entityType` so that create/update/delete emit
 * dataChangeEmitter notifications centrally — this keeps useLiveData views
 * refreshing automatically without each subclass re-implementing the events.
 * Subclass methods that perform their own apiPost/apiPut/apiDelete (without
 * calling super) still emit their own richer notifications and are unaffected.
 */
export class BaseRepository<T extends { id?: string }> {
  protected _lastTotal: number | null = null

  constructor(
    protected basePath: string,
    protected responseKey: string = '',
    protected entityType?: EntityType
  ) {}

  /** Fetch all records (up to 999) with optional extra query params */
  async getAll(params?: Record<string, string>): Promise<T[]> {
    const res: any = await apiGet(this.basePath, { limit: '999', ...params })

    // Store pagination total if available
    if (res?.pagination?.total !== undefined) {
      this._lastTotal = res.pagination.total
    }

    // If responseKey is set, extract the array from that key
    if (this.responseKey && res?.[this.responseKey]) {
      return res[this.responseKey] as T[]
    }

    // If response is already an array, return it directly
    if (Array.isArray(res)) {
      return res as T[]
    }

    // Try to auto-detect: look for the first array-valued key (excluding pagination)
    for (const key of Object.keys(res || {})) {
      if (key === 'pagination') continue
      if (Array.isArray(res[key])) {
        return res[key] as T[]
      }
    }

    return []
  }

  /** Fetch a single record by ID */
  async getById(id: string): Promise<T | undefined> {
    try {
      return await apiGet<T>(this.basePath + '/' + id)
    } catch {
      return undefined
    }
  }

  /** Create a new record — notifies dataChangeEmitter when entityType is set */
  async create(data: any): Promise<T> {
    const res: any = await apiPost<T>(this.basePath, data)
    let result = res as T
    // Unwrap if the response wraps the created entity
    if (res && typeof res === 'object' && !Array.isArray(res)) {
      if (this.responseKey && res[this.responseKey]) {
        result = res[this.responseKey] as T
      } else {
        // Check if response has a nested entity under a common key pattern
        const keys = Object.keys(res)
        if (keys.length === 2 && keys.includes('pagination')) {
          const dataKey = keys.find(k => k !== 'pagination')!
          result = res[dataKey] as T
        }
      }
    }
    this.invalidateCount()
    if (this.entityType) {
      dataChangeEmitter.notifyCreate(this.entityType, (result as any)?.id)
    }
    return result
  }

  /** Update an existing record — notifies dataChangeEmitter when entityType is set */
  async update(id: string, data: any): Promise<T> {
    const res = await apiPut<T>(this.basePath + '/' + id, data)
    if (this.entityType) {
      dataChangeEmitter.notifyUpdate(this.entityType, id)
    }
    return res
  }

  /** Delete a record — notifies dataChangeEmitter when entityType is set */
  async delete(id: string): Promise<void> {
    await apiDelete(this.basePath + '/' + id)
    this.invalidateCount()
    if (this.entityType) {
      dataChangeEmitter.notifyDelete(this.entityType, id)
    }
  }

  /** Get total count from last paginated response, or fetch it */
  async count(): Promise<number> {
    if (this._lastTotal !== null) return this._lastTotal
    const res: any = await apiGet(this.basePath, { limit: '1' })
    if (res?.pagination?.total !== undefined) {
      this._lastTotal = res.pagination.total
      return res.pagination.total
    }
    return 0
  }

  /** Invalidate cached count */
  protected invalidateCount(): void {
    this._lastTotal = null
  }
}
