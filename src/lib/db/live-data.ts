'use client'

// نظام التحديث الفوري - يبث الأحداث لما تتغير البيانات
// كل المكونات اللي بتستخدم useLiveData هتتحدث تلقائياً

type EntityType =
  | 'sales' | 'purchases' | 'workers' | 'workerAdvances' | 'workerReceipts'
  | 'workerAttendance' | 'production' | 'customers' | 'suppliers'
  | 'expenses' | 'expenseCategories' | 'factorySettings' | 'reports'
  | 'treasuryTransactions' | 'warehouses' | 'materials'
  | 'materialTransactions' | 'products' | 'productionOrders'

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

  // بث حدث تغيير
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
    let cancelled = false

    const loadData = async () => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      try {
        const result = await fetcher()
        if (mounted && !cancelled) {
          setData(result)
        }
      } catch (e: any) {
        if (mounted && !cancelled) {
          setError(e.message)
        }
      } finally {
        if (mounted && !cancelled) {
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
      cancelled = true
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
