'use client'

import { reportRepository } from './repositories'
import { dataChangeEmitter } from './live-data'
import { apiFetch } from './api-client'

const SYNC_STATUS_KEY = 'lastServerSync'
const SYNC_ENABLED_KEY = 'serverSyncEnabled'

class SyncService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private pendingChanges: Set<string> = new Set()

  // المزامنة مفعّلة افتراضياً
  isEnabled(): boolean {
    const stored = localStorage.getItem(SYNC_ENABLED_KEY)
    return stored !== 'false' // مفعّل افتراضياً ما لم يتم تعطيله صراحةً
  }

  setEnabled(enabled: boolean) {
    localStorage.setItem(SYNC_ENABLED_KEY, String(enabled))
  }

  // بدء المزامنة التلقائية - تعمل افتراضياً بدون تفاعل المستخدم
  start() {
    if (typeof window === 'undefined') return
    if (!this.isEnabled()) return

    // مزامنة فورية بعد 5 ثواني
    setTimeout(() => this.backgroundSync(), 5000)

    // مزامنة كل دقيقتين (أكثر تكراراً)
    this.intervalId = setInterval(() => this.backgroundSync(), 2 * 60 * 1000)

    // مزامنة عند العودة online
    window.addEventListener('online', () => this.backgroundSync())

    // مزامنة عند focus على التطبيق
    window.addEventListener('focus', () => this.backgroundSync())
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
    this.debounceTimer = setTimeout(() => this.backgroundSync(), 3000) // مزامنة بعد 3 ثواني من آخر تغيير
  }

  // مزامنة في الخلفية: لا ترمي أخطاء لكن تسجّل أي فشل
  private backgroundSync() {
    this.sync()
      .then((res) => {
        if (!res.success) console.warn('[sync] فشلت المزامنة التلقائية:', res.error)
      })
      .catch((e) => console.error('[sync] خطأ غير متوقع في المزامنة التلقائية:', e))
  }

  // مزامنة كاملة (push + pull)
  async sync(): Promise<{ success: boolean; pushed?: number; pulled?: number; error?: string }> {
    if (!navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }

    try {
      // 1. Push - رفع البيانات المحلية للسيرفر
      const localData = await reportRepository.exportAll()
      const pushRes = await apiFetch<{ success: boolean; results?: Record<string, number> }>('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({ data: localData.data }),
      })

      let pushed = 0
      for (const count of Object.values(pushRes.results || {})) {
        pushed += count as number
      }

      // 2. Pull - تحميل البيانات من السيرفر
      const pullRes = await apiFetch<{ success: boolean; data?: Record<string, any[]> }>('/api/sync/pull')

      let pulled = 0
      for (const records of Object.values(pullRes.data || {})) {
        pulled += (records as any[]).length
      }

      // 3. حفظ البيانات القادمة من السيرفر محلياً
      if (pullRes.data) {
        await reportRepository.importAll({ data: pullRes.data })
      }

      localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
      this.pendingChanges.clear()
      console.log('✅ Sync complete:', { pushed, pulled })

      return { success: true, pushed, pulled }
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
      const res = await apiFetch<{ results?: Record<string, number> }>('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({ data: localData.data }),
      })

      let count = 0
      for (const c of Object.values(res.results || {})) {
        count += c as number
      }

      localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
      return { success: true, count }
    } catch (e: any) {
      console.error('[sync] فشل الرفع:', e)
      return { success: false, error: e.message }
    }
  }

  // تحميل البيانات من السيرفر فقط
  async pullOnly(): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }

    try {
      const res = await apiFetch<{ data?: Record<string, any[]> }>('/api/sync/pull')

      let count = 0
      for (const records of Object.values(res.data || {})) {
        count += (records as any[]).length
      }

      if (res.data) {
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

      localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
      return { success: true, count }
    } catch (e: any) {
      console.error('[sync] فشل التحميل:', e)
      return { success: false, error: e.message }
    }
  }

  // حالة السيرفر
  async checkStatus(): Promise<{ connected: boolean; counts?: Record<string, number>; error?: string }> {
    try {
      const res = await apiFetch<{ connected: boolean; counts?: Record<string, number> }>('/api/sync/status')
      return { connected: res.connected, counts: res.counts }
    } catch (e: any) {
      console.error('[sync] تعذر التحقق من حالة الخادم:', e)
      return { connected: false, error: e.message }
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
