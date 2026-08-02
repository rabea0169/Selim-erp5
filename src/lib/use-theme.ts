'use client'

import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark'

const THEME_KEY = 'selim-erp-theme'

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  if (t === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // تحميل التيمة المحفوظة
    const saved = localStorage.getItem(THEME_KEY) as Theme | null
    if (saved) {
      setTheme(saved)
      applyTheme(saved)
    } else {
      // فحص تفضيل النظام
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const initial = prefersDark ? 'dark' : 'light'
      setTheme(initial)
      applyTheme(initial)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light'
      applyTheme(newTheme)
      localStorage.setItem(THEME_KEY, newTheme)
      return newTheme
    })
  }, [])

  return { theme, toggleTheme }
}
