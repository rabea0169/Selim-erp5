'use client'
import { BaseRepository } from './base'
import { apiPost, apiPut } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { Product, ProductionOrder, ProductionOrderStage } from '../types'

class ProductRepository extends BaseRepository<Product> {
  constructor() { super('/api/products', 'products', 'products') }

  async search(query: string): Promise<Product[]> {
    if (!query) return this.getAll()
    return this.getAll({ q: query })
  }

  async getByWarehouse(warehouseId: string): Promise<Product[]> {
    return this.getAll({ warehouseId })
  }

  async getLowStock(): Promise<Product[]> {
    const all = await this.getAll()
    return all.filter((p) => p.reorderLevel && p.quantity <= p.reorderLevel)
  }

  async addStock(productId: string, quantity: number, reason: string, referenceId?: string): Promise<void> {
    await apiPost(`/api/products/${productId}/stock`, { quantity, type: 'in', reason, referenceId })
    dataChangeEmitter.notifyUpdate('products')
  }

  async consumeStock(productId: string, quantity: number, reason: string): Promise<void> {
    await apiPost(`/api/products/${productId}/stock`, { quantity, type: 'out', reason })
    dataChangeEmitter.notifyUpdate('products')
  }
}

class ProductionOrderRepository extends BaseRepository<ProductionOrder> {
  constructor() { super('/api/production-orders', 'productionOrders', 'productionOrders') }

  async getByStatus(status: ProductionOrder['status']): Promise<ProductionOrder[]> {
    return this.getAll({ status })
  }

  async getByProduct(productId: string): Promise<ProductionOrder[]> {
    return this.getAll({ productId })
  }

  async getByDateRange(from?: string, to?: string): Promise<ProductionOrder[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }

  async createOrder(data: {
    productId: string
    productName: string
    quantity: number
    unit: string
    materials: Array<{ materialId: string; materialName: string; quantity: number; unit: string }>
    stages: Array<{ name: string }>
    expectedEndDate?: string
    notes?: string
  }): Promise<ProductionOrder> {
    const res = await apiPost<any>('/api/production-orders', data)
    dataChangeEmitter.notifyCreate('productionOrders')
    dataChangeEmitter.notifyUpdate('materials')
    dataChangeEmitter.notifyCreate('materialTransactions')
    return res.productionOrder || res
  }

  async completeStage(orderId: string, stageId: string, workerId?: string): Promise<void> {
    await apiPut(`/api/production-orders/${orderId}`, { action: 'completeStage', stageId, workerId })
    dataChangeEmitter.notifyUpdate('productionOrders')
  }

  async startStage(orderId: string, stageId: string, workerId?: string): Promise<void> {
    await apiPut(`/api/production-orders/${orderId}`, { action: 'startStage', stageId, workerId })
    dataChangeEmitter.notifyUpdate('productionOrders')
  }

  async completeOrder(orderId: string, completedQuantity: number): Promise<void> {
    await apiPut(`/api/production-orders/${orderId}`, { action: 'completeOrder', completedQuantity })
    dataChangeEmitter.notifyUpdate('productionOrders')
    dataChangeEmitter.notifyUpdate('products')
  }
}

export const productRepository = new ProductRepository()
export const productionOrderRepository = new ProductionOrderRepository()
