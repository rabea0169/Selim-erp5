'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { TrendingUp, PieChart as PieIcon, Scissors, BarChart3 } from 'lucide-react'
import { reportRepository, type ReportData } from '@/lib/db'
import { formatCurrency, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

// ألوان متناسقة مع التطبيق (emerald, amber, rose, etc.)
const CHART_COLORS = [
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
]

// أسماء الشهور بالعربي
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

interface DashboardChartsProps {
  /** بيانات التقرير - لو مش مزود، هنجلبها تلقائياً لآخر 6 شهور */
  data?: ReportData | null
  /** هل التحميل جارٍ؟ (لو مش مزود، نستخدم state داخلي) */
  loading?: boolean
  /** كلاسات إضافية */
  className?: string
}

/**
 * مكون رسوم بيانية للـ Dashboard باستخدام recharts.
 * يحتوي على 3 رسوم:
 * 1. BarChart للمبيعات آخر 6 شهور
 * 2. PieChart لتوزيع المصاريف حسب البند
 * 3. BarChart للإنتاج بالقطعة
 */
export function DashboardCharts({ data, loading, className }: DashboardChartsProps) {
  const [internalData, setInternalData] = useState<ReportData | null>(null)
  const [internalLoading, setInternalLoading] = useState(true)

  // حساب آخر 6 شهور
  const { from6MonthsAgo, today } = useMemo(() => {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    return {
      from6MonthsAgo: sixMonthsAgo.toISOString().split('T')[0],
      today: now.toISOString().split('T')[0],
    }
  }, [])

  // تحميل البيانات تلقائياً لو مش مزودة من البروب
  useEffect(() => {
    if (data !== undefined) return // لو البروب مزود، تجاهل
    let cancelled = false
    async function load() {
      setInternalLoading(true)
      try {
        const report = await reportRepository.getFullReport(from6MonthsAgo, today)
        if (!cancelled) setInternalData(report)
      } catch (e) {
        console.error('Failed to load dashboard charts data:', e)
      } finally {
        if (!cancelled) setInternalLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [data, from6MonthsAgo, today])

  const finalData = data ?? internalData
  const isLoading = loading ?? internalLoading

  // تجميع بيانات المبيعات لآخر 6 شهور
  const salesByMonth = useMemo(() => {
    if (!finalData?.sales) return []
    const now = new Date()
    const months: Array<{ month: string; total: number; count: number }> = []
    // بناء قائمة آخر 6 شهور
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        month: MONTH_NAMES_AR[d.getMonth()],
        total: 0,
        count: 0,
      })
    }
    // تجميع المبيعات حسب الشهر
    for (const s of finalData.sales) {
      const d = new Date(s.date)
      const idx = months.findIndex(
        (m, i) => {
          const md = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
          return (
            md.getMonth() === d.getMonth() && md.getFullYear() === d.getFullYear()
          )
        }
      )
      if (idx !== -1) {
        months[idx].total += s.total
        months[idx].count += 1
      }
    }
    return months
  }, [finalData])

  // تجميع المصاريف حسب البند
  const expensesByCategory = useMemo(() => {
    if (!finalData?.expensesByCategory) return []
    return Object.entries(finalData.expensesByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8) // أهم 8 بنود
  }, [finalData])

  // تجميع الإنتاج بالقطعة لكل موديل
  const productionByModel = useMemo(() => {
    if (!finalData?.productions) return []
    const map: Record<string, number> = {}
    for (const p of finalData.productions) {
      map[p.modelName] = (map[p.modelName] || 0) + p.quantity
    }
    return Object.entries(map)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8) // أهم 8 موديلات
  }, [finalData])

  if (isLoading && !finalData) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (!finalData) {
    return (
      <div className={cn('text-center py-8 text-sm text-slate-500', className)}>
        تعذّر تحميل البيانات. حاول مرة أخرى.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 1. مبيعات آخر 6 شهور */}
      <ChartCard
        title="المبيعات آخر 6 شهور"
        icon={TrendingUp}
        color="emerald"
        subtitle={`إجمالي: ${formatCurrency(
          salesByMonth.reduce((s, m) => s + m.total, 0)
        )}`}
      >
        {salesByMonth.every((m) => m.total === 0) ? (
          <EmptyChart text="لا توجد مبيعات في آخر 6 شهور" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesByMonth} margin={{ top: 10, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(148, 163, 184, 0.3)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v)}
                width={50}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'المبيعات']}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  direction: 'rtl',
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Bar
                dataKey="total"
                fill="url(#salesGradient)"
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 2. توزيع المصاريف حسب البند */}
      <ChartCard
        title="توزيع المصاريف حسب البند"
        icon={PieIcon}
        color="rose"
        subtitle={`إجمالي: ${formatCurrency(
          expensesByCategory.reduce((s, e) => s + e.value, 0)
        )}`}
      >
        {expensesByCategory.length === 0 ? (
          <EmptyChart text="لا توجد مصاريف في الفترة المحددة" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={expensesByCategory}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={45}
                paddingAngle={2}
              >
                {expensesByCategory.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name,
                ]}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  direction: 'rtl',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span style={{ fontSize: 10, color: '#64748b' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 3. الإنتاج بالقطعة */}
      <ChartCard
        title="الإنتاج بالقطعة (حسب الموديل)"
        icon={Scissors}
        color="amber"
        subtitle={`إجمالي: ${formatNumber(
          productionByModel.reduce((s, m) => s + m.qty, 0)
        )} قطعة`}
      >
        {productionByModel.length === 0 ? (
          <EmptyChart text="لا يوجد إنتاج مسجل في الفترة" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={productionByModel}
              layout="vertical"
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id="prodGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#d97706" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148, 163, 184, 0.2)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(148, 163, 184, 0.3)' }}
                tickFormatter={(v) => formatNumber(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                formatter={(value: number) => [`${formatNumber(value)} قطعة`, 'الإنتاج']}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  direction: 'rtl',
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Bar
                dataKey="qty"
                fill="url(#prodGradient)"
                radius={[0, 6, 6, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

// ===== مكونات مساعدة =====

const CARD_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/50',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-100 dark:ring-emerald-900/50',
  },
  rose: {
    bg: 'bg-rose-100 dark:bg-rose-950/50',
    text: 'text-rose-600 dark:text-rose-400',
    ring: 'ring-rose-100 dark:ring-rose-900/50',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-950/50',
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-100 dark:ring-amber-900/50',
  },
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  color,
  children,
}: {
  title: string
  subtitle?: string
  icon: any
  color: 'emerald' | 'rose' | 'amber'
  children: React.ReactNode
}) {
  const c = CARD_COLORS[color]
  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800',
        'ring-1', c.ring
      )}
      dir="rtl"
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            c.bg,
            c.text
          )}
        >
          <Icon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-center gap-2">
      <BarChart3 className="w-5 h-5 text-slate-300" />
      <p className="text-xs text-slate-400">{text}</p>
    </div>
  )
}
