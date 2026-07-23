import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  User, Worker, WorkerAdvance, WorkerReceipt, WorkerAttendance,
  Production, Customer, Supplier, Sale, SaleItem,
  Purchase, PurchaseItem, ExpenseCategory, Expense,
} from './types'

const DB_NAME = 'factory-app-db'
const DB_VERSION = 1

interface FactoryDBSchema extends DBSchema {
  users: { key: string; value: User; indexes: { 'by-username': string } }
  workers: { key: string; value: Worker; indexes: { 'by-name': string } }
  workerAdvances: { key: string; value: WorkerAdvance; indexes: { 'by-worker': string, 'by-date': string } }
  workerReceipts: { key: string; value: WorkerReceipt; indexes: { 'by-worker': string, 'by-date': string } }
  workerAttendance: { key: string; value: WorkerAttendance; indexes: { 'by-worker': string, 'by-date': string } }
  production: { key: string; value: Production; indexes: { 'by-worker': string, 'by-date': string } }
  customers: { key: string; value: Customer; indexes: { 'by-name': string } }
  suppliers: { key: string; value: Supplier; indexes: { 'by-name': string } }
  sales: { key: string; value: Sale; indexes: { 'by-date': string, 'by-customer': string } }
  saleItems: { key: string; value: SaleItem; indexes: { 'by-sale': string } }
  purchases: { key: string; value: Purchase; indexes: { 'by-date': string, 'by-supplier': string } }
  purchaseItems: { key: string; value: PurchaseItem; indexes: { 'by-purchase': string } }
  expenseCategories: { key: string; value: ExpenseCategory }
  expenses: { key: string; value: Expense; indexes: { 'by-date': string, 'by-category': string } }
}

let dbInstance: IDBPDatabase<FactoryDBSchema> | null = null

export async function getDB(): Promise<IDBPDatabase<FactoryDBSchema>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<FactoryDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // إنشاء كل الجداول مع الفهارس

      // Users
      if (!db.objectStoreNames.contains('users')) {
        const store = db.createObjectStore('users', { keyPath: 'id' })
        store.createIndex('by-username', 'username', { unique: true })
      }

      // Workers
      if (!db.objectStoreNames.contains('workers')) {
        const store = db.createObjectStore('workers', { keyPath: 'id' })
        store.createIndex('by-name', 'name')
      }

      // Worker Advances
      if (!db.objectStoreNames.contains('workerAdvances')) {
        const store = db.createObjectStore('workerAdvances', { keyPath: 'id' })
        store.createIndex('by-worker', 'workerId')
        store.createIndex('by-date', 'date')
      }

      // Worker Receipts
      if (!db.objectStoreNames.contains('workerReceipts')) {
        const store = db.createObjectStore('workerReceipts', { keyPath: 'id' })
        store.createIndex('by-worker', 'workerId')
        store.createIndex('by-date', 'date')
      }

      // Worker Attendance
      if (!db.objectStoreNames.contains('workerAttendance')) {
        const store = db.createObjectStore('workerAttendance', { keyPath: 'id' })
        store.createIndex('by-worker', 'workerId')
        store.createIndex('by-date', 'date')
      }

      // Production
      if (!db.objectStoreNames.contains('production')) {
        const store = db.createObjectStore('production', { keyPath: 'id' })
        store.createIndex('by-worker', 'workerId')
        store.createIndex('by-date', 'date')
      }

      // Customers
      if (!db.objectStoreNames.contains('customers')) {
        const store = db.createObjectStore('customers', { keyPath: 'id' })
        store.createIndex('by-name', 'name')
      }

      // Suppliers
      if (!db.objectStoreNames.contains('suppliers')) {
        const store = db.createObjectStore('suppliers', { keyPath: 'id' })
        store.createIndex('by-name', 'name')
      }

      // Sales
      if (!db.objectStoreNames.contains('sales')) {
        const store = db.createObjectStore('sales', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-customer', 'customerId_ref')
      }

      // Sale Items
      if (!db.objectStoreNames.contains('saleItems')) {
        const store = db.createObjectStore('saleItems', { keyPath: 'id' })
        store.createIndex('by-sale', 'saleId')
      }

      // Purchases
      if (!db.objectStoreNames.contains('purchases')) {
        const store = db.createObjectStore('purchases', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-supplier', 'supplierId_ref')
      }

      // Purchase Items
      if (!db.objectStoreNames.contains('purchaseItems')) {
        const store = db.createObjectStore('purchaseItems', { keyPath: 'id' })
        store.createIndex('by-purchase', 'purchaseId')
      }

      // Expense Categories
      if (!db.objectStoreNames.contains('expenseCategories')) {
        db.createObjectStore('expenseCategories', { keyPath: 'id' })
      }

      // Expenses
      if (!db.objectStoreNames.contains('expenses')) {
        const store = db.createObjectStore('expenses', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-category', 'categoryId')
      }
    },
  })

  return dbInstance
}

// توليد ID فريد
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

// التاريخ الحالي بصيغة ISO
export function nowISO(): string {
  return new Date().toISOString()
}
