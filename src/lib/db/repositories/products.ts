import { BaseRepository } from './base'
import type { Product, ProductionOrder } from '../types'

class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super('products')
  }

  async search(query: string): Promise<Product[]> {
    return super.search(query)
  }

  async getByWarehouse(warehouseId: string): Promise<Product[]> {
    const all = await this.getAll()
    return all.filter((p) => p.warehouseId === warehouseId)
  }

  async getLowStock(): Promise<Product[]> {
    const all = await this.getAll()
    return all.filter((p) => p.reorderLevel && p.quantity <= p.reorderLevel)
  }

  async addStock(productId: string, quantity: number, reason: string, referenceId?: string): Promise<void> {
    const product = await this.getById(productId)
    if (!product) throw new Error('المنتج غير موجود')
    await this.update(productId, { quantity: product.quantity + quantity } as Partial<Product>)
  }

  async consumeStock(productId: string, quantity: number, reason: string): Promise<void> {
    const product = await this.getById(productId)
    if (!product) throw new Error('المنتج غير موجود')
    if (product.quantity < quantity) {
      throw new Error(`الكمية المتاحة (${product.quantity}) أقل من المطلوب (${quantity})`)
    }
    await this.update(productId, { quantity: product.quantity - quantity } as Partial<Product>)
  }
}

class ProductionOrderRepository extends BaseRepository<ProductionOrder> {
  constructor() {
    super('productionOrders')
  }

  async getByStatus(status: ProductionOrder['status']): Promise<ProductionOrder[]> {
    const all = await this.getAll()
    return all
      .filter((o) => o.status === status)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByProduct(productId: string): Promise<ProductionOrder[]> {
    const all = await this.getAll()
    return all.filter((o) => o.productId === productId)
  }

  async getByDateRange(from?: string, to?: string): Promise<ProductionOrder[]> {
    const result = await super.search(undefined, from, to)
    return result.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
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
    const payload: Partial<ProductionOrder> = {
      productId: data.productId,
      productName: data.productName,
      quantity: data.quantity,
      completedQuantity: 0,
      unit: data.unit,
      status: 'in_progress',
      materials: data.materials.map((m) => ({
        materialId: m.materialId,
        materialName: m.materialName,
        quantity: m.quantity,
        unit: m.unit,
      })),
      stages: data.stages.map((s) => ({
        name: s.name,
        status: 'pending' as const,
      })),
      expectedEndDate: data.expectedEndDate,
      notes: data.notes,
    }
    return this.create(payload)
  }

  async completeStage(orderId: string, stageId: string, workerId?: string): Promise<void> {
    const order = await this.getById(orderId)
    if (!order) throw new Error('أمر التشغيل غير موجود')

    const stages = order.stages.map((s) => {
      if (s.id === stageId) {
        return {
          ...s,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          workerId,
        }
      }
      return s
    })

    await this.update(orderId, { stages } as Partial<ProductionOrder>)
  }

  async startStage(orderId: string, stageId: string, workerId?: string): Promise<void> {
    const order = await this.getById(orderId)
    if (!order) throw new Error('أمر التشغيل غير موجود')

    const stages = order.stages.map((s) => {
      if (s.id === stageId) {
        return {
          ...s,
          status: 'in_progress' as const,
          startedAt: new Date().toISOString(),
          workerId,
        }
      }
      return s
    })

    await this.update(orderId, { stages } as Partial<ProductionOrder>)
  }

  async completeOrder(orderId: string, completedQuantity: number): Promise<void> {
    const order = await this.getById(orderId)
    if (!order) throw new Error('أمر التشغيل غير موجود')

    await this.update(orderId, {
      completedQuantity,
      status: 'completed',
      completedDate: new Date().toISOString(),
      stages: order.stages.map((s) => ({
        ...s,
        status: 'completed' as const,
        completedAt: s.completedAt || new Date().toISOString(),
      })),
    } as Partial<ProductionOrder>)
  }
}

export const productRepository = new ProductRepository()
export const productionOrderRepository = new ProductionOrderRepository()
