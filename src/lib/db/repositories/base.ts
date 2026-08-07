'use client'

import { apiGet, apiPost, apiPut, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'

interface PaginatedResponse<T> {
  pagination?: { total: number; page: number; limit: number; pages: number }
}

/**
 * BaseRepository — generic API-based repository.
 * Replaces IndexedDB operations with server API calls.
 * Subclasses set `responseKey` to match the key used in paginated responses
 * (e.g. 'sales', 'workers', 'categories', 'transactions', etc.).
 */
export class BaseRepository<T extends { id?: string }> {
  protected _lastTotal: number | null = null

  constructor(
    protected basePath: string,
    protected responseKey: string = ''
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

  /** Create a new record */
  async create(data: any): Promise<T> {
    const res: any = await apiPost<T>(this.basePath, data)
    // Unwrap if the response wraps the created entity
    if (res && typeof res === 'object' && !Array.isArray(res)) {
      if (this.responseKey && res[this.responseKey]) {
        return res[this.responseKey] as T
      }
      // Check if response has a nested entity under a common key pattern
      const keys = Object.keys(res)
      if (keys.length === 2 && keys.includes('pagination')) {
        const dataKey = keys.find(k => k !== 'pagination')!
        return res[dataKey] as T
      }
    }
    return res as T
  }

  /** Update an existing record */
  async update(id: string, data: any): Promise<T> {
    return await apiPut<T>(this.basePath + '/' + id, data)
  }

  /** Delete a record */
  async delete(id: string): Promise<void> {
    await apiDelete(this.basePath + '/' + id)
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
