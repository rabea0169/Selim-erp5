import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import { materialRepository } from './warehouses'
import type { Product, ProductionOrder, ProductionOrderItem, ProductionOrderStage } from '../types'

class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super('products', true)
  }

  async search(query: string): Promise<Product[]> {
    const all = await this.getAll()
    if (!query) return all
    const q = query.toLowerCase()
    return all.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    )
  }

  async getByWarehouse(warehouseId: string): Promise<Product[]> {
    const db = await this.getDB() as any
    return db.getAllFromIndex('products', 'by-warehouse', warehouseId)
  }

  async getLowStock(): Promise<Product[]> {
    const all = await this.getAll()
    return all.filter((p) => p.reorderLevel && p.quantity <= p.reorderLevel)
  }

  // إضافة كمية لمنتج (بعد انتهاء التصنيع)
  async addStock(productId: string, quantity: number, reason: string, referenceId?: string): Promise<void> {
    const db = await getDB()
    const product = await db.get('products', productId)
    if (!product) throw new Error('المنتج غير موجود')

    await db.put('products', {
      ...product,
      quantity: product.quantity + quantity,
      updatedAt: nowISO(),
    })
  }

  // سحب كمية من منتج (بعد البيع)
  async consumeStock(productId: string, quantity: number, reason: string): Promise<void> {
    const db = await getDB()
    const product = await db.get('products', productId)
    if (!product) throw new Error('المنتج غير موجود')
    if (product.quantity < quantity) {
      throw new Error(`الكمية المتاحة (${product.quantity}) أقل من المطلوب (${quantity})`)
    }

    await db.put('products', {
      ...product,
      quantity: product.quantity - quantity,
      updatedAt: nowISO(),
    })
  }
}

class ProductionOrderRepository extends BaseRepository<ProductionOrder> {
  constructor() {
    super('productionOrders', true)
  }

  async getByStatus(status: ProductionOrder['status']): Promise<ProductionOrder[]> {
    const db = await this.getDB() as any
    const result = await db.getAllFromIndex('productionOrders', 'by-status', status)
    return result.sort((a: ProductionOrder, b: ProductionOrder) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  async getByProduct(productId: string): Promise<ProductionOrder[]> {
    const db = await this.getDB() as any
    return db.getAllFromIndex('productionOrders', 'by-product', productId)
  }

  async getByDateRange(from?: string, to?: string): Promise<ProductionOrder[]> {
    const db = await this.getDB() as any
    let result: ProductionOrder[]
    if (from && to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('productionOrders', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
    } else {
      result = await this.getAll()
    }
    return result.sort((a: ProductionOrder, b: ProductionOrder) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  // إنشاء أمر تشغيل جديد + سحب المواد الخام تلقائياً
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
    const db = await getDB()
    const tx = db.transaction(['productionOrders', 'materials', 'materialTransactions'], 'readwrite')

    const orderNumber = `PO-${Date.now().toString().slice(-8)}`
    const now = nowISO()

    const order: ProductionOrder = {
      id: generateId(),
      orderNumber,
      productId: data.productId,
      productName: data.productName,
      quantity: data.quantity,
      completedQuantity: 0,
      unit: data.unit,
      status: 'in_progress',
      materials: data.materials.map((m) => ({
        id: generateId(),
        materialId: m.materialId,
        materialName: m.materialName,
        quantity: m.quantity,
        unit: m.unit,
      })),
      stages: data.stages.map((s) => ({
        id: generateId(),
        name: s.name,
        status: 'pending' as const,
      })),
      date: now,
      expectedEndDate: data.expectedEndDate,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    }

    // سحب المواد الخام من المخزن
    for (const mat of data.materials) {
      const material = await tx.objectStore('materials').get(mat.materialId)
      if (!material) {
        throw new Error(`المادة ${mat.materialName} غير موجودة`)
      }
      if (material.quantity < mat.quantity) {
        throw new Error(`الكمية المتاحة من ${mat.materialName} (${material.quantity}) أقل من المطلوب (${mat.quantity})`)
      }

      // تحديث كمية المادة
      await tx.objectStore('materials').put({
        ...material,
        quantity: material.quantity - mat.quantity,
        updatedAt: now,
      })

      // تسجيل حركة السحب
      const transaction = {
        id: generateId(),
        materialId: mat.materialId,
        warehouseId: material.warehouseId,
        type: 'out' as const,
        quantity: mat.quantity,
        unitCost: material.unitCost,
        date: now,
        reason: `أمر تشغيل ${orderNumber}`,
        referenceType: 'production_order',
        referenceId: order.id,
        notes: `سحب لإنتاج ${data.productName}`,
        createdAt: now,
      }
      await tx.objectStore('materialTransactions').add(transaction)
    }

    await tx.objectStore('productionOrders').add(order)
    await tx.done

    return order
  }

  // إكمال مرحلة في أمر التشغيل
  async completeStage(orderId: string, stageId: string, workerId?: string): Promise<void> {
    const order = await this.getById(orderId)
    if (!order) throw new Error('أمر التشغيل غير موجود')

    const stages = order.stages.map((s) => {
      if (s.id === stageId) {
        return {
          ...s,
          status: 'completed' as const,
          completedAt: nowISO(),
          workerId,
        }
      }
      return s
    })

    await this.update(orderId, { stages })
  }

  // بدء مرحلة
  async startStage(orderId: string, stageId: string, workerId?: string): Promise<void> {
    const order = await this.getById(orderId)
    if (!order) throw new Error('أمر التشغيل غير موجود')

    const stages = order.stages.map((s) => {
      if (s.id === stageId) {
        return {
          ...s,
          status: 'in_progress' as const,
          startedAt: nowISO(),
          workerId,
        }
      }
      return s
    })

    await this.update(orderId, { stages })
  }

  // إكمال أمر التشغيل + إضافة الكمية لمنتج
  async completeOrder(orderId: string, completedQuantity: number): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(['productionOrders', 'products'], 'readwrite')

    const order = await tx.objectStore('productionOrders').get(orderId)
    if (!order) throw new Error('أمر التشغيل غير موجود')

    const updatedOrder: ProductionOrder = {
      ...order,
      completedQuantity,
      status: 'completed',
      completedDate: nowISO(),
      updatedAt: nowISO(),
      stages: order.stages.map((s) => ({
        ...s,
        status: 'completed' as const,
        completedAt: s.completedAt || nowISO(),
      })),
    }

    await tx.objectStore('productionOrders').put(updatedOrder)

    // إضافة الكمية للمنتج في المخزن
    if (order.productId) {
      const product = await tx.objectStore('products').get(order.productId)
      if (product) {
        await tx.objectStore('products').put({
          ...product,
          quantity: product.quantity + completedQuantity,
          updatedAt: nowISO(),
        })
      }
    }

    await tx.done
  }
}

export const productRepository = new ProductRepository()
export const productionOrderRepository = new ProductionOrderRepository()
