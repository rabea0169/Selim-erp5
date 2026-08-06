'use client'

import { reportRepository } from './repositories'
import { dataChangeEmitter } from './live-data'

const SYNC_STATUS_KEY = 'lastServerSync'
const SYNC_ENABLED_KEY = 'serverSyncEnabled'

class SyncService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private onlineHandler: (() => void) | null = null
  private pendingChanges: Set<string> = new Set()

  isEnabled(): boolean {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(SYNC_ENABLED_KEY)
    return stored === 'true'
  }

  setEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return
    localStorage.setItem(SYNC_ENABLED_KEY, String(enabled))
  }

  start() {
    if (typeof window === 'undefined') return
    if (!this.isEnabled()) return

    // مزامنة فورية بعد 10 ثواني
    setTimeout(() => { this.sync() }, 10000)

    // مزامنة دورية كل 5 دقائق
    this.intervalId = setInterval(() => { this.sync() }, 5 * 60 * 1000)

    // مزامنة تلقائية عند عودة شبكة الإنترنت
    this.onlineHandler = () => { this.sync() }
    window.addEventListener('online', this.onlineHandler)
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

  notifyChange(entityType: string) {
    this.pendingChanges.add(entityType)
    if (typeof window !== 'undefined' && navigator.onLine) {
      this.debouncedSync()
    }
  }

  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  private debouncedSync() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      Promise.resolve().then(() => this.sync())
    }, 3000)
  }

  // مزامنة كاملة تراكمية (Incremental Push + Pull)
  async sync(): Promise<{ success: boolean; pushed?: number; pulled?: number; error?: string }> {
    if (typeof window === 'undefined' || !navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }

    try {
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
          for (const count of Object.values(pushRes.results || {})) {
            pushed += count as number
          }
        }
      } catch (pushErr: any) {
        console.warn('Sync push failed (will retry later):', pushErr.message)
      }

      // 2. Incremental Pull - سحب البيانات الجديدة أو المعدلة منذ آخر مزامنة فقط
      try {
        const lastSync = this.getLastSyncDate()
        const pullResponse = await fetch('/api/sync/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ since: lastSync ? lastSync.toISOString() : undefined }),
        })
        if (!pullResponse.ok) throw new Error(`Pull failed: ${pullResponse.status}`)
        const pullRes = await pullResponse.json()

        if (pullRes.success && pullRes.data) {
          let pulled = 0
          for (const records of Object.values(pullRes.data || {})) {
            pulled += (records as any[]).length
          }

          let localCount = 0
          for (const records of Object.values(localData.data || {})) {
            localCount += (records as any[]).length
          }

          if (pulled > 0 || localCount === 0) {
            await reportRepository.importAll({ data: pullRes.data })
            console.log('✅ Incremental sync pull complete:', { pulled })

            const allTypes = [
              'sales', 'purchases', 'workers', 'workerAdvances', 'workerReceipts',
              'workerAttendance', 'production', 'customers', 'suppliers', 'expenses',
              'expenseCategories', 'factorySettings', 'treasuryTransactions',
              'warehouses', 'materials', 'materialTransactions', 'products',
              'productionOrders', 'payments', 'saleReturns', 'purchaseReturns',
            ]
            allTypes.forEach((t) => dataChangeEmitter.notifyUpdate(t as any))
          } else {
            console.log('⏭️ Incremental pull skipped: no new changes on server')
          }

          localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
          this.pendingChanges.clear()
          console.log('✅ Sync complete:', { pushed, pulled })
          return { success: true, pushed, pulled }
        }
      } catch (pullErr: any) {
        console.warn('Sync pull failed (local data preserved):', pullErr.message)
      }

      return { success: true, pushed, pulled: 0 }
    } catch (e: any) {
      console.error('Sync error:', e)
      return { success: false, error: e.message }
    }
  }

  async pushOnly(): Promise<{ success: boolean; count?: number; error?: string }> {
    if (typeof window === 'undefined' || !navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }

    try {
      const localData = await reportRepository.exportAll()
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
      for (const c of Object.values(res.results || {})) {
        count += c as number
      }

      localStorage.setItem(SYNC_STATUS_KEY, String(Date.now()))
      return { success: true, count }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  async pullOnly(): Promise<{ success: boolean; count?: number; error?: string }> {
    if (typeof window === 'undefined' || !navigator.onLine) {
      return { success: false, error: 'غير متصل بالإنترنت' }
    }

    try {
      const lastSync = this.getLastSyncDate()
      const r = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since: lastSync ? lastSync.toISOString() : undefined }),
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

      const localData = await reportRepository.exportAll()
      let localCount = 0
      for (const records of Object.values(localData.data || {})) {
        localCount += (records as any[]).length
      }

      if (count > 0 || localCount === 0) {
        if (res.data) {
          await reportRepository.importAll({ data: res.data })
          const allTypes = [
            'sales', 'purchases', 'workers', 'workerAdvances', 'workerReceipts',
            'workerAttendance', 'production', 'customers', 'suppliers', 'expenses',
            'expenseCategories', 'factorySettings', 'treasuryTransactions',
            'warehouses', 'materials', 'materialTransactions', 'products',
            'productionOrders', 'payments', 'saleReturns', 'purchaseReturns',
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

  checkStatus(): Promise<{ connected: boolean; counts?: Record<string, number> }> {
    return fetch('/api/sync/status')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((res) => ({ connected: res.connected, counts: res.counts }))
      .catch(() => ({ connected: false }))
  }

  getLastSyncDate(): Date | null {
    if (typeof window === 'undefined') return null
    const ts = localStorage.getItem(SYNC_STATUS_KEY)
    return ts ? new Date(Number(ts)) : null
  }

  isStale(): boolean {
    const last = this.getLastSyncDate()
    if (!last) return true
    return Date.now() - last.getTime() > 10 * 60 * 1000
  }
}

export const syncService = new SyncService()
