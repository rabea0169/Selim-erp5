import { getDB, generateId, nowISO } from '../connection'
import type { DatabaseSchema } from '../types'

export class BaseRepository<T extends { id?: string; createdAt?: string; updatedAt?: string }> {
  constructor(
    protected storeName: keyof DatabaseSchema,
    private hasTimestamps: boolean = true
  ) {}

  protected async getDB() {
    return getDB()
  }

  async getAll(): Promise<T[]> {
    const db = await getDB()
    return db.getAll(this.storeName as any) as Promise<T[]>
  }

  async getById(id: string): Promise<T | undefined> {
    const db = await getDB()
    return db.get(this.storeName as any, id) as Promise<T | undefined>
  }

  async create(data: Partial<T>): Promise<T> {
    const db = await getDB()
    const now = nowISO()
    const record = {
      ...data,
      id: data.id || generateId(),
      ...(this.hasTimestamps && {
        createdAt: (data as any).createdAt || now,
        updatedAt: (data as any).updatedAt || now,
      }),
    } as T

    await db.add(this.storeName as any, record as any)
    return record
  }

  async update(id: string, data: Partial<T>): Promise<T | undefined> {
    const db = await getDB()
    const existing = await db.get(this.storeName as any, id) as T | undefined
    if (!existing) return undefined

    const updated = {
      ...existing,
      ...data,
      id,
      ...(this.hasTimestamps && { updatedAt: nowISO() }),
    } as T

    await db.put(this.storeName as any, updated as any)
    return updated
  }

  async delete(id: string): Promise<void> {
    const db = await getDB()
    await db.delete(this.storeName as any, id)
  }

  async deleteMany(ids: string[]): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(this.storeName as any, 'readwrite')
    await Promise.all(ids.map((id) => tx.store.delete(id)))
    await tx.done
  }

  async count(): Promise<number> {
    const db = await getDB()
    return db.count(this.storeName as any)
  }

  async clear(): Promise<void> {
    const db = await getDB()
    await db.clear(this.storeName as any)
  }

  // دعم الفلترة بالـ index
  async getByIndex(indexName: string, value: any): Promise<T[]> {
    const db = await getDB()
    return (db as any).getAllFromIndex(this.storeName, indexName, value) as Promise<T[]>
  }

  // دعم الفلترة بنطاق تاريخ
  async getByDateRange(dateField: string, from?: string, to?: string): Promise<T[]> {
    const db = await getDB()
    const range = (() => {
      if (from && to) return IDBKeyRange.bound(from, to)
      if (from) return IDBKeyRange.lowerBound(from)
      if (to) return IDBKeyRange.upperBound(to)
      return null
    })()

    if (range) {
      return (db as any).getAllFromIndex(this.storeName, dateField, range) as Promise<T[]>
    }
    return this.getAll()
  }
}
