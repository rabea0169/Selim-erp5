'use client'

// نظام التحديث الفوري - يبث الأحداث لما تتغير البيانات
// كل المكونات اللي بتستخدم useLiveData هتتحدث تلقائياً

import { useEffect, useState, useCallback, useRef } from 'react'

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

  subscribe(type: EntityType, listener: Listener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)
    return () => {
      this.listeners.get(type)?.delete(listener)
    }
  }

  subscribeAll(listener: Listener): () => void {
    this.globalListeners.add(listener)
    return () => {
      this.globalListeners.delete(listener)
    }
  }

  emit(event: DataChangeEvent) {
    this.listeners.get(event.type)?.forEach((listener) => {
      try { listener(event) } catch (e) { console.error('Listener error:', e) }
    })
    this.globalListeners.forEach((listener) => {
      try { listener(event) } catch (e) { console.error('Global listener error:', e) }
    })
  }

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

export const dataChangeEmitter = new DataChangeEmitter()

export function useLiveData<T>(
  fetcher: () => Promise<T>,
  dependencies: EntityType[],
  initialData: T | null = null
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadFlag, setReloadFlag] = useState(0)
  // هل اكتمل التحميل الأول؟ — لمنع الجلب المزدوج عند فتح الشاشة:
  // كثير من المكونات تستدعي reload() داخل useEffect عند تغيّر البحث،
  // وأول تشغيلة للـ effect تكون مباشرة بعد الإقلاع فتسبب جلباً ثانياً مكرراً.
  const firstLoadDone = useRef(false)

  const reload = useCallback(() => {
    // تجاهل reload قبل اكتمال التحميل الأول — الجلب الابتدائي جارٍ أصلاً بنفس الـ fetcher
    if (firstLoadDone.current) {
      setReloadFlag((f) => f + 1)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      if (!mounted) return
      setLoading(true)
      setError(null)
      try {
        const result = await fetcher()
        if (mounted) setData(result)
      } catch (e: any) {
        if (mounted) setError(e.message)
      } finally {
        firstLoadDone.current = true
        if (mounted) setLoading(false)
      }
    }

    loadData()

    const unsubscribers = dependencies.map((type) =>
      dataChangeEmitter.subscribe(type, () => loadData())
    )

    return () => {
      mounted = false
      unsubscribers.forEach((unsub) => unsub())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadFlag, ...dependencies])

  return { data, loading, error, reload }
}

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
