'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // تسجيل service worker بعد تحميل الصفحة
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          console.log('✅ Service Worker مسجل')
        })
        .catch((err) => {
          console.log('Service Worker:', err.message)
        })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register)
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
