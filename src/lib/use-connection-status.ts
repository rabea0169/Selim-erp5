'use client'

import { useState, useEffect } from 'react'

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    Promise.resolve().then(() => setIsOnline(navigator.onLine))

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
