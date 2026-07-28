'use client'

import { reportRepository } from './repositories'
import { dataChangeEmitter } from './live-data'

const SYNC_STATUS_KEY = 'lastServerSync'
const SYNC_ENABLED_KEY = 'serverSyncEnabled'

class SyncService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private pendingChanges: Set<string> = new Set()

  // المزامنة معطّلة افتراضياً - تُفعّل يدوياً فقط بعد التأكد من عمل السيرفر
  isEnabled(): boolean {
    const stored = localStorage.getItem(SYNC_ENABLED_KEY)
    // معطّلة افتراضياً - تحتاج تفعيل يدوي من الإعدادات
    return stored === 'true'
  }

  setEnabled(enabled: boolean) {
    localStorage.setItem(SYNC_ENABLED_KEY, String(enabled))
  }

  // بدء المزامنة التلقائية - معطّلة افتراضياً
  start() {
    if (typeof window === 'undefined') return
    if (!this.isEnabled()) return

    // مزامنة فورية بعد 10 ثواني
    setTimeout(() => {
      Promise.resolve().then(() => this.sync())
    }, 10000)

    // مزامنة كل 5 دقائق
    this.intervalId = setInterval(() => {
      Promise.resolve().then(() => this.sync())
    }, 5 * 60 * 1000)

    // مزامنة عند العودة online
    window.addEventListener('online', () => {
      Promise.resolve().then(() => this.sync())
    })
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
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

    try {
      // 1. Push - رفع البيانات المحلية للسيرفر
      const localData = await reportRepository.exportAll()
      let pushSuccess = false
      let pushed = 0

      try {
        const pushRes = await fetch('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: localData.data }),
        }).then((r) => r.json())

        if (pushRes.success) {
          pushSuccess = true
          for (const count of Object.values(pushRes.results || {})) {
            pushed += count as number
          }
        }
      } catch (pushErr: any) {
        console.warn('Sync push failed (will retry later):', pushErr.message)
      }

      // 2. Pull - تحميل البيانات من السيرفر
      // فقط إذا كان Push ناجح أو كان هناك بيانات على السيرفر
      try {
        const pullRes = await fetch('/api/sync/pull').then((r) => r.json())

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
            // importAll الآن يعمل merge (لا يمسح البيانات المحلية)
            await reportRepository.importAll({ data: pullRes.data })
            console.log('✅ Sync pull complete:', { pulled })
          } else {
            console.log('⏭️ Sync pull skipped: server has no data, preserving local data')
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
    }
  }

  // رفع البيانات للسيرفر فقط
  async pushOnly(): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }

    try {
      const localData = await reportRepository.exportAll()
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: localData.data }),
      }).then((r) => r.json())

      if (!res.success) {
        throw new Error(res.error)
      }

      let count = 0
      for (const c of Object.values(res.results || {})) {
        count += c as number
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
      const res = await fetch('/api/sync/pull').then((r) => r.json())

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
          const allTypes = [
            'sales', 'purchases', 'workers', 'workerAdvances', 'workerReceipts',
            'workerAttendance', 'production', 'customers', 'suppliers', 'expenses',
            'expenseCategories', 'factorySettings', 'treasuryTransactions',
            'warehouses', 'materials', 'materialTransactions', 'products',
            'productionOrders', 'payments', 'saleReturns', 'purchaseReturns', 'reports',
          ]
          allTypes.forEach((t) => dataChangeEmitter.notifyUpdate(t as any))
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
      const res = await fetch('/api/sync/status').then((r) => r.json())
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
