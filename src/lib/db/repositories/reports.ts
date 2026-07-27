import { getDB } from '../connection'
import {
  saleRepository,
  purchaseRepository,
  expenseRepository,
  workerAdvanceRepository,
  workerReceiptRepository,
  productionRepository,
  workerAttendanceRepository,
} from './index'
import type {
  Sale,
  Purchase,
  WorkerAdvance,
  WorkerReceipt,
  Production,
  WorkerAttendance,
  Expense,
  DatabaseSchema,
} from '../types'

export interface ReportSummary {
  salesTotal: number
  salesPaid: number
  salesRemaining: number
  purchasesTotal: number
  purchasesPaid: number
  purchasesRemaining: number
  advancesTotal: number
  receiptsTotal: number
  productionTotal: number
  productionPieces: number
  expensesTotal: number
  netProfit: number
}

export interface ReportData {
  range: { from?: string; to?: string }
  summary: ReportSummary
  sales: Sale[]
  purchases: Purchase[]
  advances: WorkerAdvance[]
  receipts: WorkerReceipt[]
  productions: Production[]
  attendance: WorkerAttendance[]
  expenses: Expense[]
  expensesByCategory: Record<string, number>
  topItems: Array<{ name: string; qty: number; total: number }>
  topModels: Array<{ name: string; qty: number; total: number }>
}

class ReportRepository {
  async getFullReport(from?: string, to?: string): Promise<ReportData> {
    const [
      sales, purchases, expenses, advances, receipts, productions, attendance,
    ] = await Promise.all([
      saleRepository.getByDateRange(from, to),
      purchaseRepository.getByDateRange(from, to),
      expenseRepository.getByDateRange(from, to),
      workerAdvanceRepository.getByDateRange(from, to),
      workerReceiptRepository.getByDateRange(from, to),
      productionRepository.getByDateRange(from, to),
      workerAttendanceRepository.getByDateRange(from, to),
    ])

    const salesTotal = sales.reduce((s, x) => s + x.total, 0)
    const salesPaid = sales.reduce((s, x) => s + x.paid, 0)
    const purchasesTotal = purchases.reduce((s, x) => s + x.total, 0)
    const purchasesPaid = purchases.reduce((s, x) => s + x.paid, 0)
    const advancesTotal = advances.reduce((s, x) => s + x.amount, 0)
    const receiptsTotal = receipts.reduce((s, x) => s + x.amount, 0)
    const productionTotal = productions.reduce((s, x) => s + x.total, 0)
    const productionPieces = productions.reduce((s, x) => s + x.quantity, 0)
    const expensesTotal = expenses.reduce((s, x) => s + x.amount, 0)

    // المصاريف حسب البند
    const expensesByCategory: Record<string, number> = {}
    for (const e of expenses) {
      expensesByCategory[e.categoryName] = (expensesByCategory[e.categoryName] || 0) + e.amount
    }

    // أكثر الأصناف مبيعاً
    const itemAgg: Record<string, { qty: number; total: number }> = {}
    for (const s of sales) {
      for (const it of s.items) {
        if (!itemAgg[it.itemName]) itemAgg[it.itemName] = { qty: 0, total: 0 }
        itemAgg[it.itemName].qty += it.quantity
        itemAgg[it.itemName].total += it.total
      }
    }
    const topItems = Object.entries(itemAgg)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // أكثر الموديلات إنتاجاً
    const modelAgg: Record<string, { qty: number; total: number }> = {}
    for (const p of productions) {
      if (!modelAgg[p.modelName]) modelAgg[p.modelName] = { qty: 0, total: 0 }
      modelAgg[p.modelName].qty += p.quantity
      modelAgg[p.modelName].total += p.total
    }
    const topModels = Object.entries(modelAgg)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // صافي الربح
    const netProfit =
      salesTotal - purchasesTotal - expensesTotal - advancesTotal + receiptsTotal - productionTotal

    return {
      range: { from, to },
      summary: {
        salesTotal,
        salesPaid,
        salesRemaining: salesTotal - salesPaid,
        purchasesTotal,
        purchasesPaid,
        purchasesRemaining: purchasesTotal - purchasesPaid,
        advancesTotal,
        receiptsTotal,
        productionTotal,
        productionPieces,
        expensesTotal,
        netProfit,
      },
      sales,
      purchases,
      advances,
      receipts,
      productions,
      attendance,
      expenses,
      expensesByCategory,
      topItems,
      topModels,
    }
  }

  // نسخة احتياطية كاملة
  async exportAll(): Promise<any> {
    const db = await getDB()
    const tables: Array<keyof DatabaseSchema> = [
      'factorySettings', 'users', 'workers', 'workerAdvances', 'workerReceipts',
      'workerAttendance', 'production', 'customers', 'suppliers',
      'sales', 'saleItems', 'purchases', 'purchaseItems',
      'expenseCategories', 'expenses',
      'treasuryTransactions', 'warehouses', 'materials', 'materialTransactions',
      'products', 'productionOrders',
      'payments', 'saleReturns', 'saleReturnItems',
      'purchaseReturns', 'purchaseReturnItems',
    ]

    const data: any = {}
    for (const table of tables) {
      data[table] = await db.getAll(table)
    }

    return {
      version: 5,
      app: 'clothing-factory-management',
      type: 'offline-first',
      exportedAt: new Date().toISOString(),
      data,
    }
  }

  // استرجاع النسخة الاحتياطية
  async importAll(backupData: any): Promise<{ success: boolean; counts: any }> {
    if (!backupData?.data) {
      throw new Error('بيانات النسخة الاحتياطية غير صحيحة')
    }

    const db = await getDB()
    const data = backupData.data

    const tables: Array<keyof DatabaseSchema> = [
      'factorySettings', 'users', 'workers', 'workerAdvances', 'workerReceipts',
      'workerAttendance', 'production', 'customers', 'suppliers',
      'sales', 'saleItems', 'purchases', 'purchaseItems',
      'expenseCategories', 'expenses',
      'treasuryTransactions', 'warehouses', 'materials', 'materialTransactions',
      'products', 'productionOrders',
      'payments', 'saleReturns', 'saleReturnItems',
      'purchaseReturns', 'purchaseReturnItems',
    ]

    const tx = db.transaction(tables, 'readwrite')

    // حذف كل البيانات الحالية
    for (const table of tables) {
      await tx.objectStore(table).clear()
    }

    // إدراج البيانات الجديدة
    for (const table of tables) {
      const records = data[table] || []
      for (const record of records) {
        await tx.objectStore(table).put(record)
      }
    }

    await tx.done

    return {
      success: true,
      counts: {
        workers: data.workers?.length || 0,
        customers: data.customers?.length || 0,
        suppliers: data.suppliers?.length || 0,
        sales: data.sales?.length || 0,
        purchases: data.purchases?.length || 0,
        expenses: data.expenses?.length || 0,
      },
    }
  }
}

export const reportRepository = new ReportRepository()
