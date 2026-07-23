'use client'

import { useState, useEffect, useCallback } from 'react'

// Hook عام للتعامل مع async operations
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: any[] = []
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadFlag, setReloadFlag] = useState(0)

  const reload = useCallback(() => setReloadFlag((f) => f + 1), [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    asyncFn()
      .then((result) => {
        if (mounted) setData(result)
      })
      .catch((err) => {
        if (mounted) setError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadFlag])

  return { data, loading, error, reload }
}
