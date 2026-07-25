import { BaseRepository } from './base'
import type { Warehouse, Material, MaterialTransaction } from '../types'

class WarehouseRepository extends BaseRepository<Warehouse> {
  constructor() {
    super('warehouses')
  }

  async getByType(type: Warehouse['type']): Promise<Warehouse[]> {
    const all = await this.getAll()
    return all.filter((w) => w.type === type)
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
    super('materials')
  }

  async getByWarehouse(warehouseId: string): Promise<Material[]> {
    const all = await this.getAll()
    return all.filter((m) => m.warehouseId === warehouseId)
  }

  async search(query: string): Promise<Material[]> {
    return super.search(query)
  }

  async addStock(
    materialId: string,
    quantity: number,
    unitCost: number,
    reason: string,
    notes?: string
  ): Promise<void> {
    const material = await this.getById(materialId)
    if (!material) throw new Error('المادة غير موجودة')
    const totalOldValue = material.quantity * material.unitCost
    const totalNewValue = quantity * unitCost
    const newQuantity = material.quantity + quantity
    const newUnitCost = newQuantity > 0 ? (totalOldValue + totalNewValue) / newQuantity : unitCost
    await this.update(materialId, {
      quantity: newQuantity,
      unitCost: newUnitCost,
    } as Partial<Material>)
  }

  async consumeStock(
    materialId: string,
    quantity: number,
    reason: string,
    referenceType?: string,
    referenceId?: string,
    notes?: string
  ): Promise<void> {
    const material = await this.getById(materialId)
    if (!material) throw new Error('المادة غير موجودة')
    if (material.quantity < quantity) {
      throw new Error(`الكمية المتاحة (${material.quantity}) أقل من المطلوب (${quantity})`)
    }
    await this.update(materialId, {
      quantity: material.quantity - quantity,
    } as Partial<Material>)
  }

  async getTransactions(materialId: string): Promise<MaterialTransaction[]> {
    const all = await materialTransactionRepository.getAll()
    return all
      .filter((t) => t.materialId === materialId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getAllTransactions(from?: string, to?: string): Promise<MaterialTransaction[]> {
    const result = await materialTransactionRepository.search(undefined, from, to)
    return result.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }
}

class MaterialTransactionRepository extends BaseRepository<MaterialTransaction> {
  constructor() {
    super('materialTransactions')
  }

  async getByMaterial(materialId: string): Promise<MaterialTransaction[]> {
    const all = await this.getAll()
    return all
      .filter((t) => t.materialId === materialId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string): Promise<MaterialTransaction[]> {
    const result = await super.search(undefined, from, to)
    return result.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }
}

export const warehouseRepository = new WarehouseRepository()
export const materialRepository = new MaterialRepository()
export const materialTransactionRepository = new MaterialTransactionRepository()
