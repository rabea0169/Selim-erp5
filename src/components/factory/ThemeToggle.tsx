'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/use-theme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  /** كلاسات إضافية */
  className?: string
  /** حجم الزر */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * زر تبديل الوضع الليلي/النهاري.
 * يعتمد على `useTheme` hook الذي يحفظ التفضيل في localStorage.
 */
export function ThemeToggle({ className, size = 'sm' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-10 h-10',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex items-center justify-center rounded-lg transition-colors',
        'bg-slate-100 hover:bg-slate-200 text-slate-600',
        'dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300',
        sizeClasses[size],
        className
      )}
      title={isDark ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
      aria-label={isDark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
      aria-pressed={isDark}
    >
      {isDark ? (
        <Sun className={cn(iconSizes[size], 'text-amber-500')} />
      ) : (
        <Moon className={cn(iconSizes[size], 'text-slate-700')} />
      )}
    </button>
  )
}
