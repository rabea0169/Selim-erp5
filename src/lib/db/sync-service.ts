'use client'

import { reportRepository, dataChangeEmitter } from './repositories'

const SYNC_STATUS_KEY = 'lastServerSync'
const SYNC_ENABLED_KEY = 'serverSyncEnabled'

class SyncService {
  private intervalId: ReturnType<typeof setInterval> | null = null

  isEnabled(): boolean {
    return localStorage.getItem(SYNC_ENABLED_KEY) === 'true'
  }

  setEnabled(enabled: boolean) {
    localStorage.setItem(SYNC_ENABLED_KEY, String(enabled))
  }

  // بدء المزامنة التلقائية
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
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  // مزامنة كاملة (push + pull)
  async sync(): Promise<{ success: boolean; pushed?: number; pulled?: number; error?: string }> {
    if (!navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }

    try {
      // 1. Push - رفع البيانات المحلية للسيرفر
      const localData = await reportRepository.exportAll()
      const pushRes = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: localData.data }),
      }).then((r) => r.json())

      if (!pushRes.success) {
        throw new Error(pushRes.error || 'فشل الرفع')
      }

      let pushed = 0
      for (const count of Object.values(pushRes.results || {})) {
        pushed += count as number
      }

      // 2. Pull - تحميل البيانات من السيرفر
      const pullRes = await fetch('/api/sync/pull').then((r) => r.json())

      if (!pullRes.success) {
        throw new Error(pullRes.error || 'فشل التحميل')
      }

      let pulled = 0
      for (const records of Object.values(pullRes.data || {})) {
        pulled += (records as any[]).length
      }

      // 3. حفظ البيانات القادمة من السيرفر محلياً
      if (pullRes.data) {
        await reportRepository.importAll({ data: pullRes.data })
      }

      localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
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

  // تحميل البيانات من السيرفر فقط
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

      if (res.data) {
        await reportRepository.importAll({ data: res.data })
        // إشعار كل الأقسام بالتحديث
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
    return Date.now() - last.getTime() > 30 * 60 * 1000 // 30 دقيقة
  }
}

export const syncService = new SyncService()
