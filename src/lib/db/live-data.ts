'use client'

// نظام التحديث الفوري - يبث الأحداث لما تتغير البيانات
// كل المكونات اللي بتستخدم useLiveData هتتحدث تلقائياً

type EntityType =
  | 'sales' | 'purchases' | 'workers' | 'workerAdvances' | 'workerReceipts'
  | 'workerAttendance' | 'production' | 'customers' | 'suppliers'
  | 'expenses' | 'expenseCategories' | 'factorySettings' | 'reports'
  | 'treasuryTransactions' | 'warehouses' | 'materials'
  | 'materialTransactions' | 'products' | 'productionOrders'
  | 'payments' | 'saleReturns' | 'saleReturnItems'
  | 'purchaseReturns' | 'purchaseReturnItems'

interface DataChangeEvent {
  type: EntityType
  action: 'create' | 'update' | 'delete'
  id?: string
  timestamp: number
}

type Listener = (event: DataChangeEvent) => void

class DataChangeEmitter {
  private listeners = new Map<EntityType, Set<Listener>>()    
  private globalListeners = new Set<Listener>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  // الاشتراك في تغييرات نوع معين
  subscribe(type: EntityType, listener: Listener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)
    return () => {
      this.listeners.get(type)?.delete(listener)
    }
  }

  // الاشتراك في كل التغييرات
  subscribeAll(listener: Listener): () => void {
    this.globalListeners.add(listener)
    return () => {
      this.globalListeners.delete(listener)
    }
  }

  // بث حدث تغيير + حفظ احتياطي تلقائي في Cache API
  emit(event: DataChangeEvent) {
    // بث للمستمعين المحددين
    this.listeners.get(event.type)?.forEach((listener) => {
      try {
        listener(event)
      } catch (e) {
        console.error('Listener error:', e)
      }
    })

    // بث للمستمعين الشاملين
    this.globalListeners.forEach((listener) => {
      try {
        listener(event)
      } catch (e) {
        console.error('Global listener error:', e)
      }
    })

    // حفظ احتياطي تلقائي في Cache API بعد 2 ثانية من آخر تغيير
    this.scheduleCacheBackup()
  }

  // حفظ نسخة احتياطية في Cache API (debounced)
  private scheduleCacheBackup() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveToCacheAPI()
    }, 2000)
  }

  private async saveToCacheAPI() {
    try {
      const { reportRepository } = await import('./repositories')
      const data = await reportRepository.exportAll()
      const jsonStr = JSON.stringify(data)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const cache = await caches.open('auto-backups')
      // حفظ نسخة واحدة فقط (باستبدال القديمة)
      await cache.put('/auto-backup-latest', new Response(blob))
      console.log('[DB] ✅ Auto-saved snapshot to Cache API')
    } catch (e) {
      // صامت - مشكلة في الكاش مش كارثية
    }
  }

  // دوال مساعدة لبث الأحداث
  notifyCreate(type: EntityType, id?: string) {
    this.emit({ type, action: 'create', id, timestamp: Date.now() })
  }

  notifyUpdate(type: EntityType, id?: string) {
    this.emit({ type, action: 'update', id, timestamp: Date.now() })
  }

  notifyDelete(type: EntityType, id?: string) {
    this.emit({ type, action: 'delete', id, timestamp: Date.now() })
  }
}

// Singleton instance
export const dataChangeEmitter = new DataChangeEmitter()

// Hook للتحديث الفوري
import { useEffect, useState, useCallback } from 'react'

export function useLiveData<T>(
  fetcher: () => Promise<T>,
  dependencies: EntityType[],
  initialData: T | null = null
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadFlag, setReloadFlag] = useState(0)

  const reload = useCallback(() => {
    setReloadFlag((f) => f + 1)
  }, [])

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      // Already handled by the reloadFlag pattern - callers increment reloadFlag to trigger reload
      if (!mounted) return
      setLoading(true)
      setError(null)
      try {
        const result = await fetcher()
        if (mounted) {
          setData(result)
        }
      } catch (e: any) {
        if (mounted) {
          setError(e.message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    // الاشتراك في التغييرات
    const unsubscribers = dependencies.map((type) =>
      dataChangeEmitter.subscribe(type, () => {
        loadData()
      })
    )

    return () => {
      mounted = false
      unsubscribers.forEach((unsub) => unsub())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadFlag, ...dependencies])

  return { data, loading, error, reload }
}

// Hook مبسط للتحديث الفوري (بدون data - بس trigger)
export function useDataChange(callback: () => void, dependencies: EntityType[]) {
  useEffect(() => {
    const unsubscribers = dependencies.map((type) =>
      dataChangeEmitter.subscribe(type, () => callback())
    )
    return () => unsubscribers.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}

export type { EntityType, DataChangeEvent }
