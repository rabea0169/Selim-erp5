import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import { dataChangeEmitter } from '../live-data'
import type { Production } from '../types'

class ProductionRepository extends BaseRepository<Production> {
  constructor() {
    super('production', true)
  }

  async getByWorker(workerId: string): Promise<Production[]> {
    const result = await this.getByIndex('by-worker', workerId)
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<Production[]> {
    let result: Production[]
    if (from || to) {
      const db = await this.getDB()
      if (from && to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        result = await db.getAllFromIndex('production', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
      } else if (from) {
        result = await db.getAllFromIndex('production', 'by-date', IDBKeyRange.lowerBound(from))
      } else {
        const toDate = new Date(to!)
        toDate.setHours(23, 59, 59, 999)
        result = await db.getAllFromIndex('production', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
      }
    } else {
      result = await this.getAll()
    }

    if (workerId) {
      result = result.filter((p) => p.workerId === workerId)
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async createWithCalculation(data: {
    workerId: string
    date: string
    modelName: string
    quantity: number
    unitPrice: number
    productId?: string
    addToInventory?: boolean
    notes?: string
  }): Promise<Production> {
    const total = data.quantity * data.unitPrice
    const now = nowISO()

    // ===== ربط إنتاج العمال بالمخزون =====
    // إذا تم تحديد منتج، أضف الكمية المنتجة لمخزون المنتجات
    if (data.productId && data.addToInventory !== false) {
      const db = await getDB()
      const tx = db.transaction(['production', 'products'], 'readwrite')

      const record: Production = {
        id: generateId(),
        workerId: data.workerId,
        date: data.date,
        modelName: data.modelName,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        total,
        notes: data.notes,
        createdAt: now,
      }

      await tx.objectStore('production').add(record)

      // إضافة الكمية المنتجة لمخزون المنتج
      const product = await tx.objectStore('products').get(data.productId)
      if (product) {
        await tx.objectStore('products').put({
          ...product,
          quantity: product.quantity + data.quantity,
          updatedAt: now,
        })
      }

      await tx.done
      dataChangeEmitter.notifyCreate('production')
      dataChangeEmitter.notifyUpdate('products')
      return record
    }

    return this.create({
      workerId: data.workerId,
      date: data.date,
      modelName: data.modelName,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      total,
      notes: data.notes,
    })
  }
}

export const productionRepository = new ProductionRepository()
