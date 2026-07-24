'use client'

import { Wifi, WifiOff } from 'lucide-react'
import { useConnectionStatus } from '@/lib/use-connection-status'
import { cn } from '@/lib/utils'

interface ConnectionStatusProps {
  /** عرض النص بجانب الأيقونة (افتراضي: true) */
  showText?: boolean
  /** كلاسات إضافية */
  className?: string
}

/**
 * مكون بسيط يعرض حالة الاتصال (online/offline) في الـ header.
 * يعتمد على `useConnectionStatus` hook.
 */
export function ConnectionStatus({ showText = true, className }: ConnectionStatusProps) {
  const isOnline = useConnectionStatus()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
        isOnline
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
        className
      )}
      title={isOnline ? 'متصل بالإنترنت' : 'غير متصل - وضع offline'}
      dir="rtl"
    >
      <span
        className={cn(
          'inline-block w-2 h-2 rounded-full',
          isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
        )}
        aria-hidden
      />
      {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      {showText && (
        <span className="leading-none">{isOnline ? 'متصل' : 'offline'}</span>
      )}
    </div>
  )
}
