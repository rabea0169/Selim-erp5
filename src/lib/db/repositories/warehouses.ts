import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import type { Warehouse, Material, MaterialTransaction } from '../types'

class WarehouseRepository extends BaseRepository<Warehouse> {
  constructor() {
    super('warehouses', false)
  }

  async getByType(type: Warehouse['type']): Promise<Warehouse[]> {
    const db = await this.getDB() as any
    return db.getAllFromIndex('warehouses', 'by-type', type)
  }

  async seedDefaults(): Promise<void> {
    const defaults = [
      { name: 'مخزن المواد الخام', type: 'raw_materials' as const, location: '', notes: '' },
      { name: 'مخزن المنتجات المنتهية', type: 'finished_goods' as const, location: '', notes: '' },
    ]
    for (const d of defaults) {
      const existing = (await this.getAll()).find((w) => w.name === d.name)
      if (!existing) {
        await this.create(d)
      }
    }
  }
}

class MaterialRepository extends BaseRepository<Material> {
  constructor() {
    super('materials', true)
  }

  async getByWarehouse(warehouseId: string): Promise<Material[]> {
    const db = await this.getDB() as any
    return db.getAllFromIndex('materials', 'by-warehouse', warehouseId)
  }

  async search(query: string): Promise<Material[]> {
    const all = await this.getAll()
    if (!query) return all
    const q = query.toLowerCase()
    return all.filter((m) => m.name.toLowerCase().includes(q))
  }

  // إضافة كمية لمادة + تسجيل الحركة
  async addStock(
    materialId: string,
    quantity: number,
    unitCost: number,
    reason: string,
    notes?: string
  ): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(['materials', 'materialTransactions'], 'readwrite')

    const material = await tx.objectStore('materials').get(materialId)
    if (!material) throw new Error('المادة غير موجودة')

    // حساب متوسط التكلفة
    const totalOldValue = material.quantity * material.unitCost
    const totalNewValue = quantity * unitCost
    const newQuantity = material.quantity + quantity
    const newUnitCost = newQuantity > 0 ? (totalOldValue + totalNewValue) / newQuantity : unitCost

    await tx.objectStore('materials').put({
      ...material,
      quantity: newQuantity,
      unitCost: newUnitCost,
      updatedAt: nowISO(),
    })

    // تسجيل الحركة
    const transaction: MaterialTransaction = {
      id: generateId(),
      materialId,
      warehouseId: material.warehouseId,
      type: 'in',
      quantity,
      unitCost,
      date: nowISO(),
      reason,
      notes,
      createdAt: nowISO(),
    }
    await tx.objectStore('materialTransactions').add(transaction)

    await tx.done
  }

  // سحب كمية من مادة + تسجيل الحركة
  async consumeStock(
    materialId: string,
    quantity: number,
    reason: string,
    referenceType?: string,
    referenceId?: string,
    notes?: string
  ): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(['materials', 'materialTransactions'], 'readwrite')

    const material = await tx.objectStore('materials').get(materialId)
    if (!material) throw new Error('المادة غير موجودة')
    if (material.quantity < quantity) {
      throw new Error(`الكمية المتاحة (${material.quantity}) أقل من المطلوب (${quantity})`)
    }

    await tx.objectStore('materials').put({
      ...material,
      quantity: material.quantity - quantity,
      updatedAt: nowISO(),
    })

    const transaction: MaterialTransaction = {
      id: generateId(),
      materialId,
      warehouseId: material.warehouseId,
      type: 'out',
      quantity,
      unitCost: material.unitCost,
      date: nowISO(),
      reason,
      referenceType,
      referenceId,
      notes,
      createdAt: nowISO(),
    }
    await tx.objectStore('materialTransactions').add(transaction)

    await tx.done
  }

  // الحركات لمادة معينة
  async getTransactions(materialId: string): Promise<MaterialTransaction[]> {
    const db = await this.getDB() as any
    const result = await db.getAllFromIndex('materialTransactions', 'by-material', materialId)
    return result.sort((a: MaterialTransaction, b: MaterialTransaction) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  // كل الحركات
  async getAllTransactions(from?: string, to?: string): Promise<MaterialTransaction[]> {
    const db = await this.getDB() as any
    let result: MaterialTransaction[]
    if (from && to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('materialTransactions', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
    } else {
      result = await db.getAll('materialTransactions')
    }
    return result.sort((a: MaterialTransaction, b: MaterialTransaction) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }
}

class MaterialTransactionRepository extends BaseRepository<MaterialTransaction> {
  constructor() {
    super('materialTransactions', false)
  }

  async getByMaterial(materialId: string): Promise<MaterialTransaction[]> {
    const db = await this.getDB() as any
    const result = await db.getAllFromIndex('materialTransactions', 'by-material', materialId)
    return result.sort((a: MaterialTransaction, b: MaterialTransaction) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  async getByDateRange(from?: string, to?: string): Promise<MaterialTransaction[]> {
    const db = await this.getDB() as any
    let result: MaterialTransaction[]
    if (from && to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('materialTransactions', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
    } else if (from) {
      result = await db.getAllFromIndex('materialTransactions', 'by-date', IDBKeyRange.lowerBound(from))
    } else if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('materialTransactions', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
    } else {
      result = await this.getAll()
    }
    return result.sort((a: MaterialTransaction, b: MaterialTransaction) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }
}

export const warehouseRepository = new WarehouseRepository()
export const materialRepository = new MaterialRepository()
export const materialTransactionRepository = new MaterialTransactionRepository()
