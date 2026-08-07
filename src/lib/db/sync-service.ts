'use client'

import { reportRepository } from './repositories'
import { dataChangeEmitter } from './live-data'

// TODO: Implement incremental sync with lastSyncTimestamp per entity type to avoid exporting all data on every change

const SYNC_STATUS_KEY = 'lastServerSync'
const SYNC_ENABLED_KEY = 'serverSyncEnabled'

class SyncService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private onlineHandler: (() => void) | null = null
  private pendingChanges: Set<string> = new Set()
  private _lastPullTime = 0
  private _isSyncing = false

  // خريطة تحويل: أسماء Prisma (مفرد من السيرفر) ← أسماء IndexedDB (جمع محلي)
  private static SERVER_TO_LOCAL_MAP: Record<string, string> = {
    factorySettings: 'factorySettings',
    worker: 'workers',
    workerAdvance: 'workerAdvances',
    workerReceipt: 'workerReceipts',
    workerAttendance: 'workerAttendance',
    production: 'production',
    customer: 'customers',
    supplier: 'suppliers',
    sale: 'sales',
    saleItem: 'saleItems',
    purchase: 'purchases',
    purchaseItem: 'purchaseItems',
    expenseCategory: 'expenseCategories',
    expense: 'expenses',
    treasuryTransaction: 'treasuryTransactions',
    warehouse: 'warehouses',
    material: 'materials',
    materialTransaction: 'materialTransactions',
    product: 'products',
    productionOrder: 'productionOrders',
    payment: 'payments',
    saleReturn: 'saleReturns',
    purchaseReturn: 'purchaseReturns',
    auditLog: 'auditLogs',
  }

  // تحويل أسماء الجداول القادمة من السيرفر لأسماء IndexedDB المحلية
  // + استخراج العناصر المضمنة (items) من المرتجعات
  private convertServerToLocalKeys(serverData: Record<string, any[]>): Record<string, any[]> {
    const localData: Record<string, any[]> = {}
    const returnItems: { saleReturnItems: any[]; purchaseReturnItems: any[] } = { saleReturnItems: [], purchaseReturnItems: [] }

    for (const [serverKey, records] of Object.entries(serverData)) {
      const localKey = SyncService.SERVER_TO_LOCAL_MAP[serverKey]
      if (localKey) {
        // معالجة المرتجعات: استخراج items المضمنة
        if (serverKey === 'saleReturn') {
          for (const rec of records as any[]) {
            if (Array.isArray(rec.items) && rec.items.length > 0) {
              for (const item of rec.items) {
                returnItems.saleReturnItems.push({
                  id: item.id,
                  returnId: rec.id,
                  saleItemId: item.saleItemId,
                  itemName: item.itemName,
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                })
              }
            }
          }
        }
        if (serverKey === 'purchaseReturn') {
          for (const rec of records as any[]) {
            if (Array.isArray(rec.items) && rec.items.length > 0) {
              for (const item of rec.items) {
                returnItems.purchaseReturnItems.push({
                  id: item.id,
                  returnId: rec.id,
                  purchaseItemId: item.purchaseItemId,
                  itemName: item.itemName,
                  materialId: item.materialId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                })
              }
            }
          }
        }
        localData[localKey] = records
      } else {
        console.warn(`[Sync] No mapping for server key: ${serverKey}`)
        localData[serverKey] = records
      }
    }

    // إضافة عناصر المرتجعات كجداول منفصلة
    if (returnItems.saleReturnItems.length > 0) {
      localData['saleReturnItems'] = returnItems.saleReturnItems
    }
    if (returnItems.purchaseReturnItems.length > 0) {
      localData['purchaseReturnItems'] = returnItems.purchaseReturnItems
    }

    return localData
  }

  // قائمة بأنواع البيانات لإعلامها
  private static ALL_TYPES = [
    'sales', 'purchases', 'workers', 'workerAdvances', 'workerReceipts',
    'workerAttendance', 'production', 'customers', 'suppliers', 'expenses',
    'expenseCategories', 'factorySettings', 'treasuryTransactions',
    'warehouses', 'materials', 'materialTransactions', 'products',
    'productionOrders', 'payments', 'saleReturns', 'purchaseReturns',
  ] as const

  // إشعار مجمّع — يخلي React يعمل render مرة واحدة بدل 21 مرة
  private notifyAllTypes() {
    // تجميع كل الإشعارات في إطار واحد
    requestAnimationFrame(() => {
      SyncService.ALL_TYPES.forEach((t) => dataChangeEmitter.notifyUpdate(t))
    })
  }

  // المزامنة مُفعّلة افتراضياً لضمان عملها على كل الأجهزة
  isEnabled(): boolean {
    const stored = localStorage.getItem(SYNC_ENABLED_KEY)
    // مُفعّلة افتراضياً - لو المستخدم ما عطّلهاش
    return stored !== 'false'
  }

  setEnabled(enabled: boolean) {
    localStorage.setItem(SYNC_ENABLED_KEY, String(enabled))
  }

  // بدء المزامنة التلقائية
  start() {
    if (typeof window === 'undefined') return
    if (!this.isEnabled()) return
    if (this.intervalId) return // Already running

    // مزامنة كل 2 دقيقة (بدون مزامنة فورية — initialPull يعملها أول)
    this.intervalId = setInterval(() => { this.sync() }, 2 * 60 * 1000)

    // مزامنة عند العودة online
    this.onlineHandler = () => { this.sync() }
    window.addEventListener('online', this.onlineHandler)
  }

  // سحب تلقائي للبيانات من السيرفر عند أول دخول على جهاز جديد
  async initialPull(): Promise<{ success: boolean; count?: number; error?: string }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'not in browser' }
    }
    if (!navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }
    // منع تشغيل sync بالتوازي مع initialPull
    if (this._isSyncing) return { success: false, error: 'sync in progress' }
    this._isSyncing = true

    try {
      const { reportRepository } = await import('./repositories')
      const localData = await reportRepository.exportAll()
      let localCount = 0
      for (const records of Object.values(localData.data || {})) {
        localCount += (records as any[]).length
      }

      // إذا عندك بيانات محلية، اسحب من السيرفر ودمج
      // إذا مفيش بيانات محلية، اسحب كل حاجة
      const r = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const res = await r.json()

      if (!res.success) {
        throw new Error(res.error)
      }

      let serverCount = 0
      for (const records of Object.values(res.data || {})) {
        serverCount += (records as any[]).length
      }

      if (serverCount > 0) {
        // تحويل أسماء الجداول من السيرفر (مفرد) للمحلي (جمع) ثم دمج
        const convertedData = this.convertServerToLocalKeys(res.data)
        await reportRepository.importAll({ data: convertedData })
        this._lastPullTime = Date.now()
        // إشعار مجمّع — مرة واحدة فقط
        this.notifyAllTypes()
        console.log(`✅ Initial pull: ${serverCount} records from server (local had ${localCount})`)
      }

      localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
      return { success: true, count: serverCount }
    } catch (e: any) {
      console.warn('Initial pull failed (non-fatal):', e.message)
      return { success: false, error: e.message }
    } finally {
      this._isSyncing = false
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler)
      this.onlineHandler = null
    }
  }

  // تسجيل تغيير للمزامنة الفورية
  notifyChange(entityType: string) {
    this.pendingChanges.add(entityType)
    // مزامنة فورية لو متصل
    if (navigator.onLine) {
      this.debouncedSync()
    }
  }

  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private _syncScheduled = false

  private debouncedSync() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    // تجميع التغييرات — sync واحد فقط بعد 3 ثواني من آخر تغيير
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      if (!this._syncScheduled) {
        this._syncScheduled = true
        Promise.resolve().then(() => {
          this.sync().finally(() => { this._syncScheduled = false })
        })
      }
    }, 3000)
  }

  // مزامنة كاملة (push + pull) - مع حماية البيانات المحلية
  async sync(): Promise<{ success: boolean; pushed?: number; pulled?: number; error?: string }> {
    if (!navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }
    // منع تشغيل مزامنة بالتوازي
    if (this._isSyncing) return { success: false, error: 'sync in progress' }
    // تخطي السحب لو عملنا سحب منذ أقل من 90 ثانية
    const skipPull = (Date.now() - this._lastPullTime) < 90_000

    this._isSyncing = true
    try {
      // 1. Push - رفع البيانات المحلية للسيرفر
      const localData = await reportRepository.exportAll()
      let localCount = 0
      for (const records of Object.values(localData.data || {})) {
        localCount += (records as any[]).length
      }
      let pushSuccess = false
      let pushed = 0

      // حماية: لا ترفع بيانات فاضية — تجنب إرسال طلب ضخم بدون فائدة
      const shouldPush = localCount > 0 || this.pendingChanges.size > 0
      if (shouldPush) {
        try {
          const pushResponse = await fetch('/api/sync/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: localData.data }),
          })
          if (!pushResponse.ok) throw new Error(`Push failed: ${pushResponse.status}`)
          const pushRes = await pushResponse.json()

          if (pushRes.success) {
            pushSuccess = true
            for (const result of Object.values(pushRes.results || {}) as Array<{success: number; failed: number}>) {
              pushed += result.success
            }
          }
        } catch (pushErr: any) {
          console.warn('Sync push failed (will retry later):', pushErr.message)
        }
      } // end shouldPush

      // 2. Pull - تحميل البيانات من السيرفر
      // دائماً نسحب حتى لو لم نرفع (للحصول على بيانات من أجهزة أخرى)
      try {
        // Fix O: Use POST instead of GET
        const pullResponse = await fetch('/api/sync/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!pullResponse.ok) throw new Error(`Pull failed: ${pullResponse.status}`)
        const pullRes = await pullResponse.json()

        if (pullRes.success && pullRes.data) {
          let pulled = 0
          for (const records of Object.values(pullRes.data || {})) {
            pulled += (records as any[]).length
          }

          // حماية: لا تسحب بيانات فاضية إذا عندك بيانات محلية
          let localCount = 0
          for (const records of Object.values(localData.data || {})) {
            localCount += (records as any[]).length
          }

          if (pulled > 0 || localCount === 0) {
            if (!skipPull) {
              // تحويل أسماء الجداول من أسماء Prisma (مفرد) لأسماء IndexedDB (جمع)
              const convertedData = this.convertServerToLocalKeys(pullRes.data)
              await reportRepository.importAll({ data: convertedData })
              this._lastPullTime = Date.now()
              console.log('✅ Sync pull complete:', { pulled })
              // إشعار مجمّع
              this.notifyAllTypes()
            } else {
              console.log('⏭️ Sync pull skipped: initialPull was recent')
            }
          }
        }

        localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
        this.pendingChanges.clear()
        console.log('✅ Sync complete:', { pushed, pulled })
        return { success: true, pushed, pulled: pulled || 0 }
      } catch (pullErr: any) {
        console.warn('Sync pull failed (local data preserved):', pullErr.message)
      }

      // Push أو Pull فشل - البيانات المحلية محفوظة
      return { success: true, pushed, pulled: 0 }
    } catch (e: any) {
      console.error('Sync error:', e)
      return { success: false, error: e.message }
    } finally {
      this._isSyncing = false
    }
  }

  // رفع البيانات للسيرفر فقط
  async pushOnly(): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }

    try {
      const localData = await reportRepository.exportAll()
      // Fix N: Check HTTP response status
      const r = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: localData.data }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const res = await r.json()

      if (!res.success) {
        throw new Error(res.error)
      }

      let count = 0
      for (const r of Object.values(res.results || {}) as Array<{success: number; failed: number}>) {
        count += r.success
      }

      localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
      return { success: true, count }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  // تحميل البيانات من السيرفر فقط - مع حماية البيانات المحلية
  async pullOnly(): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }

    try {
      // Fix N + Fix O: Check HTTP status and use POST
      const r = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const res = await r.json()

      if (!res.success) {
        throw new Error(res.error)
      }

      let count = 0
      for (const records of Object.values(res.data || {})) {
        count += (records as any[]).length
      }

      // حماية: لا تسحب بيانات فاضية إذا عندك بيانات محلية
      const localData = await reportRepository.exportAll()
      let localCount = 0
      for (const records of Object.values(localData.data || {})) {
        localCount += (records as any[]).length
      }

      if (count > 0 || localCount === 0) {
        if (res.data) {
          // تحويل أسماء الجداول من السيرفر (مفرد) للمحلي (جمع)
          const convertedData = this.convertServerToLocalKeys(res.data)
          await reportRepository.importAll({ data: convertedData })
          this._lastPullTime = Date.now()
          // إشعار مجمّع
          this.notifyAllTypes()
        }
      } else {
        console.log('⏭️ Pull skipped: server empty, local data preserved')
        return { success: true, count: 0 }
      }

      localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
      return { success: true, count }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  // حالة السيرفر
  async checkStatus(): Promise<{ connected: boolean; counts?: Record<string, number> }> {
    try {
      // Fix N: Check HTTP response status
      const r = await fetch('/api/sync/status')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const res = await r.json()
      return { connected: res.connected, counts: res.counts }
    } catch {
      return { connected: false }
    }
  }

  getLastSyncDate(): Date | null {
    const ts = localStorage.getItem(SYNC_STATUS_KEY)
    return ts ? new Date(Number(ts)) : null
  }

  isStale(): boolean {
    const last = this.getLastSyncDate()
    if (!last) return true
    return Date.now() - last.getTime() > 10 * 60 * 1000 // 10 دقائق
  }
}

export const syncService = new SyncService()
