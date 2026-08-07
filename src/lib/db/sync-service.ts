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

    // مزامنة فورية قصيرة بعد تسجيل الدخول لرفع أي بيانات محلية معلقة
    setTimeout(() => { this.sync() }, 1000)

    // مزامنة كل 2 دقيقة
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

    try {
      const { reportRepository } = await import('./repositories')
      const localData = await reportRepository.exportAll()
      let localCount = 0
      for (const records of Object.values(localData.data || {})) {
        localCount += (records as any[]).length
      }

      // إذا يوجد بيانات محلية على هذا الجهاز، ارفعها أولاً حتى لا تبقى حبيسة الجهاز
      if (localCount > 0) {
        try {
          const pushResponse = await fetch('/api/sync/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: localData.data }),
          })
          if (pushResponse.ok) {
            const pushRes = await pushResponse.json()
            let pushed = 0
            for (const result of Object.values(pushRes.results || {}) as Array<{ success: number; failed: number }>) {
              pushed += result.success
            }
            console.log(`✅ Initial push: ${pushed} local records uploaded before pull`)
          }
        } catch (pushErr: any) {
          console.warn('Initial push failed (will retry by auto sync):', pushErr.message)
        }
      }

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
        // دمج بيانات السيرفر مع البيانات المحلية
        await reportRepository.importAll({ data: res.data })
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

  private debouncedSync() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      Promise.resolve().then(() => this.sync())
    }, 3000) // مزامنة بعد 3 ثواني من آخر تغيير
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
      let pushSuccess = false
      let pushed = 0

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

      // 2. Pull - تحميل البيانات من السيرفر
      // فقط إذا كان Push ناجح أو كان هناك بيانات على السيرفر
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
              // importAll الآن يعمل merge (لا يمسح البيانات المحلية)
              await reportRepository.importAll({ data: pullRes.data })
              this._lastPullTime = Date.now()
              console.log('✅ Sync pull complete:', { pulled })
              // إشعار مجمّع
              this.notifyAllTypes()
            } else {
              console.log('⏭️ Sync pull skipped: initialPull was recent')
            }
          }

          localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
          this.pendingChanges.clear()
          console.log('✅ Sync complete:', { pushed, pulled })
          return { success: true, pushed, pulled }
        }
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
          // importAll الآن يعمل merge (لا يمسح البيانات المحلية)
          await reportRepository.importAll({ data: res.data })
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
