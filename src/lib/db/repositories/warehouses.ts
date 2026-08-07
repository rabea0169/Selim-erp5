'use client'
import { BaseRepository } from './base'
import { apiGet, apiPost, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { Warehouse, Material, MaterialTransaction } from '../types'

class WarehouseRepository extends BaseRepository<Warehouse> {
  constructor() { super('/api/warehouses', 'warehouses') }

  async getByType(type: Warehouse['type']): Promise<Warehouse[]> {
    return this.getAll({ type })
  }

  async seedDefaults(): Promise<void> {
    try { await apiPost('/api/seed') } catch { /* already seeded */ }
  }
}

class MaterialRepository extends BaseRepository<Material> {
  constructor() { super('/api/materials', 'materials') }

  async getByWarehouse(warehouseId: string): Promise<Material[]> {
    return this.getAll({ warehouseId })
  }

  async search(query: string): Promise<Material[]> {
    if (!query) return this.getAll()
    return this.getAll({ q: query })
  }

  async addStock(materialId: string, quantity: number, unitCost: number, reason: string, notes?: string): Promise<void> {
    await apiPost('/api/materials/stock', { materialId, quantity, unitCost, type: 'in', reason, notes })
    dataChangeEmitter.notifyUpdate('materials')
    dataChangeEmitter.notifyCreate('materialTransactions')
  }

  async consumeStock(materialId: string, quantity: number, reason: string, referenceType?: string, referenceId?: string, notes?: string): Promise<void> {
    await apiPost('/api/materials/stock', { materialId, quantity, type: 'out', reason, referenceType, referenceId, notes })
    dataChangeEmitter.notifyUpdate('materials')
    dataChangeEmitter.notifyCreate('materialTransactions')
  }

  /** تسوية جرد — newQuantity هو الرصيد الجديد المطلق */
  async adjustStock(materialId: string, newQuantity: number, reason: string, notes?: string): Promise<void> {
    await apiPost('/api/materials/stock', { materialId, quantity: newQuantity, type: 'adjustment', reason, notes })
    dataChangeEmitter.notifyUpdate('materials')
    dataChangeEmitter.notifyCreate('materialTransactions')
  }

  async getTransactions(materialId: string): Promise<MaterialTransaction[]> {
    try { return await apiGet<MaterialTransaction[]>(`/api/materials/${materialId}/transactions`) } catch { return [] }
  }

  async getAllTransactions(from?: string, to?: string): Promise<MaterialTransaction[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    try { return await apiGet<MaterialTransaction[]>('/api/material-transactions', params) } catch { return [] }
  }
}

class MaterialTransactionRepository extends BaseRepository<MaterialTransaction> {
  constructor() { super('/api/material-transactions', 'materialTransactions') }

  async getByMaterial(materialId: string): Promise<MaterialTransaction[]> {
    try { return await apiGet<MaterialTransaction[]>(`/api/materials/${materialId}/transactions`) } catch { return [] }
  }

  async getByDateRange(from?: string, to?: string): Promise<MaterialTransaction[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }
}

export const warehouseRepository = new WarehouseRepository()
export const materialRepository = new MaterialRepository()
export const materialTransactionRepository = new MaterialTransactionRepository()
