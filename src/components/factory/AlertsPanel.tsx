'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, X, ChevronLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { alertsService, type SmartAlert } from '@/lib/db'
import { cn } from '@/lib/utils'

// ألوان وأيقونات حسب نوع التنبيه
const ALERT_STYLES: Record<
  SmartAlert['type'],
  { bg: string; border: string; text: string; dot: string }
> = {
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-900',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-900',
    text: 'text-blue-800 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  danger: {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-900',
    text: 'text-rose-800 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-900',
    text: 'text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
}

const TYPE_LABEL: Record<SmartAlert['type'], string> = {
  warning: 'تحذير',
  info: 'معلومة',
  danger: 'خطر',
  success: 'نجاح',
}

interface AlertsPanelProps {
  /** دالة التنقل عند الضغط على زر التنبيه (تستقبل actionTarget) */
  onNavigate?: (target: string) => void
  /** كلاسات إضافية */
  className?: string
}

/**
 * لوحة التنبيهات الذكية.
 * تعرض عدد التنبيهات في badge بالـ header، وعند الضغط تفتح Dialog
 * يعرض كل التنبيهات مع إمكانية التنقل للصفحة المناسبة.
 */
export function AlertsPanel({ onNavigate, className }: AlertsPanelProps) {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<SmartAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // تحميل التنبيهات
  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const r = await alertsService.getAlerts()
      setAlerts(r)
      setLastUpdated(new Date().toLocaleTimeString('ar-EG'))
    } catch (e) {
      console.error('Failed to load alerts:', e)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [])

  // تحميل أول مرة + كل دقيقة (للتنبيهات الزمنية)
  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 60_000) // كل دقيقة
    return () => clearInterval(interval)
  }, [loadAlerts])

  // التنبيهات الظاهرة (بعد استبعاد المُتجاهلة)
  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id))
  const alertCount = visibleAlerts.length

  // عدد التنبيهات الحرجة (danger + warning) للـ badge الأحمر
  const criticalCount = visibleAlerts.filter(
    (a) => a.type === 'danger' || a.type === 'warning'
  ).length

  // التعامل مع زر الإجراء
  const handleAction = (alert: SmartAlert) => {
    if (alert.actionType === 'navigate' && alert.actionTarget) {
      setOpen(false)
      onNavigate?.(alert.actionTarget)
    } else if (alert.actionType === 'dismiss') {
      handleDismiss(alert.id)
    }
  }

  // تجاهل تنبيه
  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          // إعادة تحميل عند الفتح لضمان التحديث
          if (!open) loadAlerts()
        }}
        className={cn(
          'relative inline-flex items-center justify-center rounded-lg transition-colors',
          'bg-slate-100 hover:bg-slate-200 text-slate-600',
          'dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300',
          'w-8 h-8',
          className
        )}
        title={`التنبيهات (${alertCount})`}
        aria-label={`عرض ${alertCount} تنبيه`}
      >
        <Bell className="w-4 h-4" />
        {alertCount > 0 && (
          <span
            className={cn(
              'absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center',
              criticalCount > 0
                ? 'bg-rose-500 animate-pulse'
                : 'bg-emerald-500'
            )}
          >
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden" dir="rtl">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-2 text-right">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div className="flex-1">
                <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                  التنبيهات
                </span>
                {alertCount > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                    ({alertCount})
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadAlerts}
                disabled={loading}
                className="h-8 w-8"
                title="تحديث"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </Button>
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              تنبيهات ذكية عن حالة المصنع والمستحقات والمصاريف
            </DialogDescription>
          </DialogHeader>

          {/* قائمة التنبيهات */}
          <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2">
            {loading && alerts.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : visibleAlerts.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-2">
                <span className="text-4xl">✅</span>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  لا توجد تنبيهات حالياً
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  كل شيء على ما يرام! سننبّهك عند حدوث شيء مهم.
                </p>
              </div>
            ) : (
              visibleAlerts.map((alert) => {
                const style = ALERT_STYLES[alert.type]
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'rounded-xl border p-3 relative',
                      style.bg,
                      style.border
                    )}
                  >
                    {/* زر الإغلاق */}
                    <button
                      type="button"
                      onClick={() => handleDismiss(alert.id)}
                      className="absolute top-2 left-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label="تجاهل التنبيه"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-start gap-3 pl-6">
                      {/* أيقونة التنبيه */}
                      <span className="w-10 h-10 rounded-lg bg-white/70 dark:bg-slate-900/40 flex items-center justify-center text-xl shrink-0">
                        {alert.icon}
                      </span>

                      {/* محتوى التنبيه */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn('w-2 h-2 rounded-full', style.dot)}
                            aria-hidden
                          />
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {alert.title}
                          </h4>
                          <Badge
                            variant="secondary"
                            className={cn('text-[9px] px-1.5 py-0', style.text, 'bg-transparent border-0')}
                          >
                            {TYPE_LABEL[alert.type]}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {alert.message}
                        </p>

                        {/* زر الإجراء */}
                        {alert.actionLabel && alert.actionType && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(alert)}
                            className={cn(
                              'mt-2 h-7 text-[11px] gap-1',
                              'bg-white/70 hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70',
                              style.text,
                              style.border
                            )}
                          >
                            {alert.actionLabel}
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* تذييل */}
          {visibleAlerts.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>آخر تحديث: {lastUpdated}</span>
              <button
                type="button"
                onClick={() => setDismissed(new Set(visibleAlerts.map((a) => a.id)))}
                className="hover:text-slate-700 dark:hover:text-slate-300"
              >
                تجاهل الكل
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
