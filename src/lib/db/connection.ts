// ⚠️ ملف قديم (Legacy / غير مستخدم حالياً)
// هذا المخطط الخاص بـ IndexedDB (27 مخزناً) كان يُستخدم قبل الانتقال الكامل إلى Server API.
// لا يوجد أي استيراد لهذا الملف في الكود الحالي (تم التحقق بالبحث)، لذا لا تتم أي تهيئة
// له عند الإقلاع ولا يستهلك موارد. أُبقي للمرجعية فقط — لا تحذفه إلا بعد التأكد الكامل.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  FactorySettings, AuditLogEntry, User, Worker, WorkerAdvance, WorkerReceipt, WorkerAttendance,
  Production, Customer, Supplier, Sale, SaleItem,
  Purchase, PurchaseItem, ExpenseCategory, Expense,
  TreasuryTransaction, Warehouse, Material, MaterialTransaction,
  Product, ProductionOrder,
  Payment, SaleReturn, SaleReturnItem, PurchaseReturn, PurchaseReturnItem,
} from './types'

const DB_NAME = 'selim-erp-db'
const DB_VERSION = 5

interface FactoryDBSchema extends DBSchema {
  factorySettings: { key: string; value: FactorySettings }
  auditLogs: { key: string; value: AuditLogEntry }
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
  // الخزينة
  treasuryTransactions: { key: string; value: TreasuryTransaction; indexes: { 'by-date': string, 'by-type': string } }
  // المخازن
  warehouses: { key: string; value: Warehouse; indexes: { 'by-type': string } }
  materials: { key: string; value: Material; indexes: { 'by-warehouse': string, 'by-name': string } }
  materialTransactions: { key: string; value: MaterialTransaction; indexes: { 'by-material': string, 'by-date': string, 'by-warehouse': string } }
  // المنتجات وأوامر التشغيل
  products: { key: string; value: Product; indexes: { 'by-name': string, 'by-warehouse': string } }
  productionOrders: { key: string; value: ProductionOrder; indexes: { 'by-date': string, 'by-status': string, 'by-product': string } }
  // السدادات والمرتجعات
  payments: { key: string; value: Payment; indexes: { 'by-date': string, 'by-party': string, 'by-type': string } }
  saleReturns: { key: string; value: SaleReturn; indexes: { 'by-date': string, 'by-sale': string, 'by-customer': string } }
  saleReturnItems: { key: string; value: SaleReturnItem; indexes: { 'by-return': string } }
  purchaseReturns: { key: string; value: PurchaseReturn; indexes: { 'by-date': string, 'by-purchase': string, 'by-supplier': string } }
  purchaseReturnItems: { key: string; value: PurchaseReturnItem; indexes: { 'by-return': string } }
}

let dbInstance: IDBPDatabase<FactoryDBSchema> | null = null
let dbOpenPromise: Promise<IDBPDatabase<FactoryDBSchema>> | null = null

// حفظ عدد السجلات الأخير للكشف عن فقدان البيانات
const LAST_KNOWN_COUNT_KEY = 'db_last_known_count'

export async function getDB(): Promise<IDBPDatabase<FactoryDBSchema>> {
  // لو الاتصال الحالي مغلق أو معطّل، أنشئ اتصال جديد
  const instance = dbInstance  // Capture reference locally to prevent race condition
  if (instance) {
    try {
      // تحقق بسيط أن الاتصال لا يزال صالحاً
      const names = instance.objectStoreNames
      if (names && names.length > 0) return instance
    } catch {
      dbInstance = null
      dbOpenPromise = null
    }
  }

  // تجنب فتح اتصالات متعددة في نفس الوقت (مهم مع React StrictMode)
  if (dbOpenPromise) {
    try {
      const db = await dbOpenPromise
      // تحقق أن الاتصال اللي سبق فتحه لا يزال صالحاً
      const names = db.objectStoreNames
      if (names && names.length > 0) {
        dbInstance = db
        return db
      }
    } catch {
      // الاتصال السابق فشل أو اتمسح، نحاول من جديد
      dbOpenPromise = null
    }
  }

  dbOpenPromise = openDB<FactoryDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`[DB] Upgrade: ${oldVersion} → ${newVersion}, stores: [${Array.from(db.objectStoreNames).join(', ')}]`)

      // إنشاء كل الجداول مع الفهارس (محمي بـ if.contains)
      if (!db.objectStoreNames.contains('factorySettings')) {
        db.createObjectStore('factorySettings', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('auditLogs')) {
        db.createObjectStore('auditLogs', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('users')) {
        const store = db.createObjectStore('users', { keyPath: 'id' })
        store.createIndex('by-username', 'username', { unique: true })
      }
      if (!db.objectStoreNames.contains('workers')) {
        const store = db.createObjectStore('workers', { keyPath: 'id' })
        store.createIndex('by-name', 'name')
      }
      if (!db.objectStoreNames.contains('workerAdvances')) {
        const store = db.createObjectStore('workerAdvances', { keyPath: 'id' })
        store.createIndex('by-worker', 'workerId')
        store.createIndex('by-date', 'date')
      }
      if (!db.objectStoreNames.contains('workerReceipts')) {
        const store = db.createObjectStore('workerReceipts', { keyPath: 'id' })
        store.createIndex('by-worker', 'workerId')
        store.createIndex('by-date', 'date')
      }
      if (!db.objectStoreNames.contains('workerAttendance')) {
        const store = db.createObjectStore('workerAttendance', { keyPath: 'id' })
        store.createIndex('by-worker', 'workerId')
        store.createIndex('by-date', 'date')
      }
      if (!db.objectStoreNames.contains('production')) {
        const store = db.createObjectStore('production', { keyPath: 'id' })
        store.createIndex('by-worker', 'workerId')
        store.createIndex('by-date', 'date')
      }
      if (!db.objectStoreNames.contains('customers')) {
        const store = db.createObjectStore('customers', { keyPath: 'id' })
        store.createIndex('by-name', 'name')
      }
      if (!db.objectStoreNames.contains('suppliers')) {
        const store = db.createObjectStore('suppliers', { keyPath: 'id' })
        store.createIndex('by-name', 'name')
      }
      if (!db.objectStoreNames.contains('sales')) {
        const store = db.createObjectStore('sales', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-customer', 'customerId_ref')
      }
      if (!db.objectStoreNames.contains('saleItems')) {
        const store = db.createObjectStore('saleItems', { keyPath: 'id' })
        store.createIndex('by-sale', 'saleId')
      }
      if (!db.objectStoreNames.contains('purchases')) {
        const store = db.createObjectStore('purchases', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-supplier', 'supplierId_ref')
      }
      if (!db.objectStoreNames.contains('purchaseItems')) {
        const store = db.createObjectStore('purchaseItems', { keyPath: 'id' })
        store.createIndex('by-purchase', 'purchaseId')
      }
      if (!db.objectStoreNames.contains('expenseCategories')) {
        db.createObjectStore('expenseCategories', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('expenses')) {
        const store = db.createObjectStore('expenses', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-category', 'categoryId')
      }
      if (!db.objectStoreNames.contains('treasuryTransactions')) {
        const store = db.createObjectStore('treasuryTransactions', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-type', 'type')
      }
      if (!db.objectStoreNames.contains('warehouses')) {
        const store = db.createObjectStore('warehouses', { keyPath: 'id' })
        store.createIndex('by-type', 'type')
      }
      if (!db.objectStoreNames.contains('materials')) {
        const store = db.createObjectStore('materials', { keyPath: 'id' })
        store.createIndex('by-warehouse', 'warehouseId')
        store.createIndex('by-name', 'name')
      }
      if (!db.objectStoreNames.contains('materialTransactions')) {
        const store = db.createObjectStore('materialTransactions', { keyPath: 'id' })
        store.createIndex('by-material', 'materialId')
        store.createIndex('by-date', 'date')
        store.createIndex('by-warehouse', 'warehouseId')
      }
      if (!db.objectStoreNames.contains('products')) {
        const store = db.createObjectStore('products', { keyPath: 'id' })
        store.createIndex('by-name', 'name')
        store.createIndex('by-warehouse', 'warehouseId')
      }
      if (!db.objectStoreNames.contains('productionOrders')) {
        const store = db.createObjectStore('productionOrders', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-status', 'status')
        store.createIndex('by-product', 'productId')
      }
      if (!db.objectStoreNames.contains('payments')) {
        const store = db.createObjectStore('payments', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-party', 'partyId')
        store.createIndex('by-type', 'type')
      }
      if (!db.objectStoreNames.contains('saleReturns')) {
        const store = db.createObjectStore('saleReturns', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-sale', 'saleId')
        store.createIndex('by-customer', 'customerId_ref')
      }
      if (!db.objectStoreNames.contains('saleReturnItems')) {
        const store = db.createObjectStore('saleReturnItems', { keyPath: 'id' })
        store.createIndex('by-return', 'returnId')
      }
      if (!db.objectStoreNames.contains('purchaseReturns')) {
        const store = db.createObjectStore('purchaseReturns', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-purchase', 'purchaseId')
        store.createIndex('by-supplier', 'supplierId_ref')
      }
      if (!db.objectStoreNames.contains('purchaseReturnItems')) {
        const store = db.createObjectStore('purchaseReturnItems', { keyPath: 'id' })
        store.createIndex('by-return', 'returnId')
      }

      console.log(`[DB] Upgrade complete. Total stores: ${db.objectStoreNames.length}`)
    },
    blocked(currentVersion, requestedVersion, event) {
      console.warn(`[DB] Version blocked: ${currentVersion} < ${requestedVersion}, allowing upgrade`)
    },
    terminated() {
      console.error('[DB] ⚠️ Database connection terminated unexpectedly!')
      dbInstance = null
      dbOpenPromise = null
    },
  })

  // ★ الإصلاح الجذري: انتظر حتى تفتح قاعدة البيانات فعلاً قبل استخدامها
  dbInstance = await dbOpenPromise

  // استمع لأحداث إغلاق قاعدة البيانات لاكتشاف المشاكل
  dbInstance.addEventListener('versionchange', (event) => {
    console.warn(`[DB] ⚠️ versionchange event: old=${event.oldVersion} new=${event.newVersion}`)
    dbInstance = null
    dbOpenPromise = null
  })

  dbInstance.addEventListener('close', () => {
    console.warn('[DB] ⚠️ Database connection closed by browser/system')
    dbInstance = null
    dbOpenPromise = null
  })

  // تحقق سريع أن قاعدة البيانات تعمل
  try {
    const stores = dbInstance.objectStoreNames
    console.log(`[DB] Opened successfully. ${stores.length} stores: ${Array.from(stores).join(', ')}`)
  } catch (e) {
    console.error('[DB] Error after open:', e)
  }

  return dbInstance
}

// توليد ID فريد باستخدام crypto.randomUUID مع fallback
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback using crypto.getRandomValues
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
  }
  // Last resort fallback
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// التاريخ الحالي بصيغة ISO
export function nowISO(): string {
  return new Date().toISOString()
}

// للتشخيص: عد جميع السجلات في كل store
export async function getDBStats(): Promise<Record<string, number>> {
  const db = await getDB()
  const stats: Record<string, number> = {}
  const storeNames = ['factorySettings', 'users', 'auditLogs', 'workers', 'workerAdvances', 'workerReceipts',
    'workerAttendance', 'production', 'customers', 'suppliers',
    'sales', 'saleItems', 'purchases', 'purchaseItems',
    'expenseCategories', 'expenses', 'treasuryTransactions',
    'warehouses', 'materials', 'materialTransactions', 'products',
    'productionOrders', 'payments', 'saleReturns', 'saleReturnItems',
    'purchaseReturns', 'purchaseReturnItems']
  for (const name of storeNames) {
    try {
      stats[name] = await (db as any).count(name)
    } catch {
      stats[name] = -1
    }
  }

  // حفظ العدد في localStorage للكشف عن فقدان البيانات عند التحميل التالي
  const totalRecords = Object.values(stats).reduce((a: number, b: number) => a + Math.max(0, b), 0)
  if (totalRecords > 0) {
    try {
      localStorage.setItem(LAST_KNOWN_COUNT_KEY, String(totalRecords))
    } catch {}
  }

  return stats
}

// فحص سلامة البيانات — يُستدعى عند تحميل التطبيق
// يفحص IndexedDB + Cache API لاكتشاف الفقدان حتى في أول استخدام
export async function checkDataIntegrity(): Promise<{ ok: boolean; currentCount: number; lastKnownCount: number; lost: boolean; cacheAvailable: boolean }> {
  const stats = await getDBStats()
  const currentCount = Object.values(stats).reduce((a: number, b: number) => a + Math.max(0, b), 0)
  const lastKnownStr = localStorage.getItem(LAST_KNOWN_COUNT_KEY)
  const lastKnownCount = lastKnownStr ? Number(lastKnownStr) : 0

  // فحص ثانوي: هل فيه بيانات في Cache API؟
  let cacheAvailable = false
  if (currentCount < 5) {
    try {
      const cache = await caches.open('auto-backups')
      const latestResponse = await cache.match('/auto-backup-latest')
      if (latestResponse) {
        const text = await latestResponse.text()
        if (text) {
          const parsed = JSON.parse(text)
          let cacheCount = 0
          if (parsed?.data) {
            for (const table of Object.keys(parsed.data)) {
              if (Array.isArray(parsed.data[table])) {
                cacheCount += parsed.data[table].length
              }
            }
          }
          cacheAvailable = cacheCount >= 5
          if (cacheAvailable && !lastKnownCount) {
            // أول استخدام ولا يوجد عد محفوظ — استخدم عد الكاش
            console.log(`[DB] No lastKnownCount, but Cache API has ${cacheCount} records`)
          }
        }
      }
    } catch {
      // Cache API غير متاح
    }
  }

  const lost = (lastKnownCount > 0 && currentCount < lastKnownCount && currentCount < 5)
    || (currentCount < 5 && cacheAvailable)

  if (lost) {
    console.error(`[DB] DATA LOSS DETECTED! Previous: ${lastKnownCount}, Current: ${currentCount}, Cache: ${cacheAvailable}`)
  }
  return { ok: !lost, currentCount, lastKnownCount, lost, cacheAvailable }
}
