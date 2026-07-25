import type { DatabaseSchema } from '../types'
import { ApiError, apiFetch } from '../api-client'

// ====== خريطة: storeName → API path + response key ======
const API_MAP: Record<string, { path: string; listKey: string; singleKey: string }> = {
  workers:             { path: '/api/workers',             listKey: 'workers',             singleKey: 'worker' },
  customers:           { path: '/api/customers',           listKey: 'customers',           singleKey: 'customer' },
  suppliers:           { path: '/api/suppliers',           listKey: 'suppliers',           singleKey: 'supplier' },
  sales:               { path: '/api/sales',               listKey: 'sales',               singleKey: 'sale' },
  purchases:           { path: '/api/purchases',           listKey: 'purchases',           singleKey: 'purchase' },
  expenses:            { path: '/api/expenses',            listKey: 'expenses',            singleKey: 'expense' },
  products:            { path: '/api/products',            listKey: 'products',            singleKey: 'product' },
  warehouses:          { path: '/api/warehouses',          listKey: 'warehouses',          singleKey: 'warehouse' },
  materials:           { path: '/api/materials',           listKey: 'materials',           singleKey: 'material' },
  treasuryTransactions:{ path: '/api/treasury',           listKey: 'transactions',        singleKey: 'transaction' },
  workerAdvances:      { path: '/api/worker-advances',     listKey: 'advances',            singleKey: 'advance' },
  workerReceipts:      { path: '/api/worker-receipts',     listKey: 'receipts',            singleKey: 'receipt' },
  workerAttendance:    { path: '/api/attendance',           listKey: 'attendance',           singleKey: 'record' },
  production:          { path: '/api/production',           listKey: 'productions',          singleKey: 'production' },
  productionOrders:    { path: '/api/production-orders',   listKey: 'orders',              singleKey: 'order' },
  expenseCategories:   { path: '/api/expense-categories',  listKey: 'categories',           singleKey: 'category' },
}

// ====== تحويل تاريخ ISO من/to string إلى صيغة التسلسل ======
function serializeDate(d: any): any {
  if (!d) return d
  if (typeof d === 'string') return d
  if (d instanceof Date) return d.toISOString()
  return d
}

export class BaseRepository<T extends { id?: string; createdAt?: any; updatedAt?: any }> {
  protected storeName: keyof DatabaseSchema
  protected apiPath: string
  protected listKey: string
  protected singleKey: string

  constructor(storeName: keyof DatabaseSchema, apiPath?: string, listKey?: string, singleKey?: string) {
    this.storeName = storeName
    const mapping = API_MAP[storeName as string]
    this.apiPath = apiPath || mapping?.path || `/api/${storeName}`
    this.listKey = listKey || mapping?.listKey || storeName as string
    this.singleKey = singleKey || mapping?.singleKey || (storeName as string).replace(/s$/, '')
  }

  // تحويل بيانات السيرفر (Date objects) إلى صيغة العميل (string)
  protected normalizeRecord(record: any): T {
    if (!record) return record
    const r = { ...record }
    // تحويل Date إلى string
    for (const key of Object.keys(r)) {
      if (r[key] instanceof Date) {
        r[key] = r[key].toISOString()
      }
    }
    // إضافة مصفوفة items فارغة إذا كانت مطلوبة
    if (this.storeName === 'sales' && !r.items) r.items = []
    if (this.storeName === 'purchases' && !r.items) r.items = []
    return r as T
  }

  async getAll(): Promise<T[]> {
    const data = await apiFetch<Record<string, any>>(this.apiPath)
    const list = data[this.listKey] || []
    return list.map((r: any) => this.normalizeRecord(r))
  }

  async getById(id: string): Promise<T | undefined> {
    try {
      const data = await apiFetch<Record<string, any>>(`${this.apiPath}/${id}`)
      const record = data[this.singleKey] || data
      return this.normalizeRecord(record)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return undefined
      throw e
    }
  }

  async search(query?: string, from?: string, to?: string): Promise<T[]> {
    const p = new URLSearchParams()
    if (query) p.set('q', query)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const qs = p.toString()
    const data = await apiFetch<Record<string, any>>(`${this.apiPath}${qs ? '?' + qs : ''}`)
    const list = data[this.listKey] || []
    return list.map((r: any) => this.normalizeRecord(r))
  }

  async create(data: Partial<T>): Promise<T> {
    const payload = { ...data }
    // لا نرسل الحقول المحسوبة أو الفارغة
    delete (payload as any).id
    delete (payload as any).createdAt
    delete (payload as any).updatedAt
    // تحويل التواريخ
    for (const key of Object.keys(payload)) {
      payload[key] = serializeDate(payload[key])
    }

    const result = await apiFetch<Record<string, any>>(this.apiPath, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return this.normalizeRecord(result[this.singleKey] || result)
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const payload = { ...data }
    delete (payload as any).id
    delete (payload as any).createdAt
    // تحويل التواريخ
    for (const key of Object.keys(payload)) {
      payload[key] = serializeDate(payload[key])
    }

    const result = await apiFetch<Record<string, any>>(`${this.apiPath}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    return this.normalizeRecord(result[this.singleKey] || result)
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`${this.apiPath}/${id}`, { method: 'DELETE' })
  }

  async count(): Promise<number> {
    const all = await this.getAll()
    return all.length
  }

  // ====== هذه الدوال محفوظة للتوافق مع الكود الموجود ======
  async deleteMany(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => this.delete(id)))
  }

  async clear(): Promise<void> {
    console.warn(`[API] clear() not supported for ${this.storeName}`)
  }

  async getByIndex(_indexName: string, _value: any): Promise<T[]> {
    console.warn(`[API] getByIndex() not supported, falling back to getAll()`)
    return this.getAll()
  }

  async getByDateRange(from?: string, to?: string): Promise<T[]> {
    return this.search(undefined, from, to)
  }
}
