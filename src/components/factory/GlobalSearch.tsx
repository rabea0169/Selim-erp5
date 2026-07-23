'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { globalSearchService, type SearchResult } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

// خريطة لتحويل نوع النتيجة إلى التبويب المناسب
const TYPE_TO_TAB: Record<SearchResult['type'], string> = {
  sale: 'sales',
  purchase: 'purchases',
  worker: 'workers',
  customer: 'sales', // العملاء يُدارون داخل شاشة المبيعات
  supplier: 'purchases', // الموردين يُدارون داخل شاشة المشتريات
  expense: 'expenses',
}

// ترجمة نوع النتيجة للعربية
const TYPE_LABEL: Record<SearchResult['type'], string> = {
  sale: 'مبيعة',
  purchase: 'مشتريات',
  worker: 'عامل',
  customer: 'عميل',
  supplier: 'مورد',
  expense: 'مصروف',
}

// ألوان Badge لكل نوع
const TYPE_COLORS: Record<SearchResult['type'], string> = {
  sale: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  purchase: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  worker: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400',
  customer: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  supplier: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400',
  expense: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
}

interface GlobalSearchProps {
  /** دالة التنقل عند الضغط على نتيجة (تستقبل التبويب) */
  onNavigate?: (tab: string) => void
  /** متغير لعرض زر البحث بشكل منفرد */
  showTrigger?: boolean
  /** كلاسات إضافية للزر */
  className?: string
}

/**
 * نافذة بحث شاملة (Ctrl+K) - تبحث في كل الجداول:
 * مبيعات، مشتريات، عمال، عملاء، موردين، مصاريف.
 */
export function GlobalSearch({ onNavigate, showTrigger = true, className }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // فتح نافذة البحث بـ Ctrl+K أو Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      // إغلاق بـ Escape
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // التركيز على حقل البحث عند الفتح
  useEffect(() => {
    if (open) {
      // تأخير بسيط حتى يظهر الـ Dialog
      const t = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(t)
    } else {
      // إعادة الضبط عند الإغلاق
      setQuery('')
      setResults([])
      setActiveIndex(0)
    }
  }, [open])

  // تنفيذ البحث مع debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setActiveIndex(0)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await globalSearchService.search(query)
        setResults(r)
        setActiveIndex(0)
      } catch (e) {
        console.error('Global search error:', e)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // التنقل للنتيجة المختارة
  const handleSelect = useCallback(
    (result: SearchResult) => {
      const tab = TYPE_TO_TAB[result.type]
      setOpen(false)
      onNavigate?.(tab)
    },
    [onNavigate]
  )

  // التنقل بالكيبورد داخل النتائج
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    }
  }

  // تمرير العنصر النشط للعرض
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <>
      {showTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200',
            'text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300',
            'px-2 py-1.5 text-xs font-medium transition-colors',
            className
          )}
          title="بحث شامل (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">بحث</span>
          <kbd className="hidden sm:inline-block rounded bg-white/70 dark:bg-slate-900/70 px-1 py-0.5 text-[9px] font-mono border border-slate-200 dark:border-slate-700">
            Ctrl K
          </kbd>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-2xl p-0 gap-0 overflow-hidden"
          dir="rtl"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>البحث الشامل</DialogTitle>
            <DialogDescription>
              ابحث في كل المبيعات والمشتريات والعمال والعملاء والموردين والمصاريف
            </DialogDescription>
          </DialogHeader>

          {/* حقل البحث */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 p-3">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ابحث عن فاتورة، عامل، عميل، مصروف..."
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-9 text-sm"
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />}
            {query && !loading && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600 shrink-0"
                aria-label="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 shrink-0 px-1"
              aria-label="إغلاق"
            >
              <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono">
                Esc
              </kbd>
            </button>
          </div>

          {/* النتائج */}
          <div
            ref={listRef}
            className="max-h-[60vh] overflow-y-auto"
            role="listbox"
            aria-label="نتائج البحث"
          >
            {!query.trim() ? (
              <EmptyState
                icon="🔍"
                title="ابحث في كل بيانات المصنع"
                hint="جرّب: اسم عميل، رقم فاتورة، عامل، أو نوع مصروف"
              />
            ) : loading ? (
              <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <span>جارٍ البحث...</span>
              </div>
            ) : results.length === 0 ? (
              <EmptyState
                icon="📭"
                title="لا توجد نتائج"
                hint={`لم نجد شيئاً يطابق "${query}"`}
              />
            ) : (
              <ul className="py-1">
                {results.map((r, idx) => (
                  <li key={`${r.type}-${r.id}`} role="option" aria-selected={idx === activeIndex}>
                    <button
                      type="button"
                      data-idx={idx}
                      onClick={() => handleSelect(r)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'w-full text-right flex items-center gap-3 px-3 py-2.5 transition-colors',
                        idx === activeIndex
                          ? 'bg-emerald-50 dark:bg-emerald-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      )}
                    >
                      {/* أيقونة النتيجة */}
                      <span className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg shrink-0">
                        {r.icon}
                      </span>

                      {/* نص النتيجة */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {r.title}
                          </p>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[9px] px-1.5 py-0 shrink-0',
                              TYPE_COLORS[r.type]
                            )}
                          >
                            {TYPE_LABEL[r.type]}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {r.subtitle}
                        </p>
                      </div>

                      {/* بيانات إضافية: المبلغ والتاريخ */}
                      <div className="flex flex-col items-end shrink-0">
                        {r.amount !== undefined && (
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(r.amount)}
                          </span>
                        )}
                        {r.date && (
                          <span className="text-[10px] text-slate-400">
                            {formatDate(r.date)}
                          </span>
                        )}
                      </div>

                      {/* سهم التنقل */}
                      <ArrowLeft
                        className={cn(
                          'w-4 h-4 shrink-0 transition-opacity',
                          idx === activeIndex
                            ? 'text-emerald-600 opacity-100'
                            : 'text-slate-300 opacity-0'
                        )}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* تذييل بالاختصارات */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center justify-between text-[10px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono">↑↓</kbd>
                تنقل
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono">↵</kbd>
                فتح
              </span>
            </div>
            {results.length > 0 && (
              <span className="text-slate-400">{results.length} نتيجة</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EmptyState({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="p-8 text-center flex flex-col items-center gap-2">
      <span className="text-3xl">{icon}</span>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{hint}</p>
    </div>
  )
}
