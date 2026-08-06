'use client'

import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  ShoppingCart,
  Package,
  FileText,
  ArrowLeft,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateTime, todayStr, startOfMonth } from '@/lib/format'
import {
  reportRepository,
  saleRepository,
  expenseRepository,
  productRepository,
  useLiveData,
  type ReportData,
  type Sale,
  type Expense,
  type Product,
} from '@/lib/db'
import { DashboardCharts } from './DashboardCharts'
import type { TabKey } from '@/app/page'

interface DashboardProps {
  onNavigate: (t: TabKey) => void
}

interface DashboardReports {
  todayData: ReportData
  monthData: ReportData
  recentSales: Sale[]
  recentExpenses: Expense[]
  lowStockProducts: Product[]
}

type RecentOperation = {
  id: string
  type: 'sale' | 'expense'
  title: string
  amount: number
  date: string
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const today = todayStr()
  const start = startOfMonth()

  // جلب تقرير اليوم + تقرير الشهر + آخر العمليات + تنبيهات المخزون مع التحديث الفوري
  const { data, loading } = useLiveData<DashboardReports>(async () => {
    const [todayReport, monthReport, recentSales, recentExpenses, lowStockProducts] =
      await Promise.all([
        reportRepository.getFullReport(today, today),
        reportRepository.getFullReport(start, today),
        saleRepository.getByDateRange(),
        expenseRepository.getByDateRange(),
        productRepository.getLowStock(),
      ])
    return {
      todayData: todayReport,
      monthData: monthReport,
      recentSales: recentSales.slice(0, 3),
      recentExpenses: recentExpenses.slice(0, 2),
      lowStockProducts,
    }
  }, [
    'sales', 'purchases', 'expenses', 'workerAdvances', 'workerReceipts',
    'production', 'workers', 'products',
  ])

  if (loading || !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const { todayData, monthData, recentSales, recentExpenses, lowStockProducts } = data

  // دمج آخر 3 مبيعات + آخر 2 مصاريف ثم ترتيبهم بالأحدث
  const recentOps: RecentOperation[] = [
    ...recentSales.map((s) => ({
      id: s.id,
      type: 'sale' as const,
      title: `مبيعة - ${s.customerName}`,
      amount: s.total,
      date: s.date,
    })),
    ...recentExpenses.map((e) => ({
      id: e.id,
      type: 'expense' as const,
      title: `مصروف - ${e.categoryName}`,
      amount: e.amount,
      date: e.date,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)

  const quickCards = [
    {
      label: 'المبيعات',
      value: monthData.summary.salesTotal,
      icon: ShoppingCart,
      color: 'from-emerald-500 to-teal-600',
      tab: 'sales' as TabKey,
    },
    {
      label: 'المشتريات',
      value: monthData.summary.purchasesTotal,
      icon: Package,
      color: 'from-amber-500 to-orange-600',
      tab: 'purchases' as TabKey,
    },
    {
      label: 'المصاريف',
      value: monthData.summary.expensesTotal,
      icon: Wallet,
      color: 'from-rose-500 to-red-600',
      tab: 'expenses' as TabKey,
    },
    {
      label: 'سلف الموظفين',
      value: monthData.summary.advancesTotal,
      icon: Users,
      color: 'from-purple-500 to-violet-600',
      tab: 'workers' as TabKey,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Today summary */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
          ملخص اليوم
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="مبيعات اليوم"
            value={todayData.summary.salesTotal}
            icon={TrendingUp}
            color="emerald"
          />
          <StatCard
            label="مصاريف اليوم"
            value={todayData.summary.expensesTotal}
            icon={TrendingDown}
            color="rose"
          />
          <StatCard
            label="سلف اليوم"
            value={todayData.summary.advancesTotal}
            icon={Users}
            color="purple"
          />
          <StatCard
            label="قبض اليوم"
            value={todayData.summary.receiptsTotal}
            icon={Wallet}
            color="blue"
          />
        </div>
      </div>

      {/* Month summary - net profit */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-0 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-emerald-400"></div>
          <div className="absolute -bottom-4 -left-4 w-32 h-32 rounded-full bg-teal-400"></div>
        </div>
        <CardContent className="p-5 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-300 mb-1">صافي الربح هذا الشهر</p>
              <p className="text-3xl font-bold text-white">
                {formatCurrency(monthData.summary.netProfit)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white/10 backdrop-blur rounded-lg p-2">
              <p className="text-slate-300">إجمالي المبيعات</p>
              <p className="font-bold text-emerald-300">
                {formatCurrency(monthData.summary.salesTotal)}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-2">
              <p className="text-slate-300">إجمالي المصاريف</p>
              <p className="font-bold text-rose-300">
                {formatCurrency(
                  monthData.summary.purchasesTotal +
                    monthData.summary.expensesTotal +
                    monthData.summary.advancesTotal
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick navigation */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
          الوصول السريع
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickCards.map((c) => {
            const Icon = c.icon
            return (
              <button
                key={c.label}
                onClick={() => onNavigate(c.tab)}
                className="group bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all text-right"
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-2 shadow-sm`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs text-slate-500 mb-0.5">{c.label}</p>
                <p className="text-sm font-bold text-slate-800">
                  {formatCurrency(c.value)}
                </p>
                <div className="flex items-center justify-end mt-1 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px]">عرض التفاصيل</span>
                  <ArrowLeft className="w-3 h-3" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* تنبيهات المخزون */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-amber-500 rounded-full"></span>
          تنبيهات المخزون
        </h2>
        {lowStockProducts.length === 0 ? (
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">المخزون بحالة جيدة ✓</p>
              <p className="text-xs text-emerald-600">لا توجد منتجات منخفضة المخزون</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {lowStockProducts.slice(0, 6).map((p) => (
              <button
                key={p.id}
                onClick={() => onNavigate('products')}
                className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-right hover:bg-amber-100 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-amber-700 mt-0.5">
                      <span>المتاح: {p.quantity} {p.unit}</span>
                      {p.reorderLevel && (
                        <Badge variant="outline" className="text-[9px] bg-white text-amber-700 border-amber-200 h-4 px-1">
                          حد: {p.reorderLevel}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {lowStockProducts.length > 6 && (
              <button
                onClick={() => onNavigate('products')}
                className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center text-xs text-slate-600 hover:bg-slate-100 transition-colors"
              >
                +{lowStockProducts.length - 6} منتجات أخرى
              </button>
            )}
          </div>
        )}
      </div>

      {/* آخر العمليات */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
          آخر العمليات
        </h2>
        {recentOps.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-100">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">لا توجد عمليات حديثة</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {recentOps.map((op, idx) => {
              const isSale = op.type === 'sale'
              return (
                <div
                  key={`${op.type}-${op.id}`}
                  className={`flex items-center gap-3 p-3 ${
                    idx !== recentOps.length - 1 ? 'border-b border-slate-50' : ''
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSale
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {isSale ? (
                      <ArrowDownToLine className="w-4 h-4" />
                    ) : (
                      <ArrowUpFromLine className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{op.title}</p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDateTime(op.date)}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <p
                      className={`text-sm font-bold ${
                        isSale ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isSale ? '+' : '-'}
                      {formatCurrency(op.amount)}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[9px] mt-0.5 ${
                        isSale
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {isSale ? 'مبيعة' : 'مصروف'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Reports CTA */}
      <button
        onClick={() => onNavigate('reports')}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-all flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div className="text-right">
            <p className="font-bold">التقارير الشاملة</p>
            <p className="text-xs text-emerald-50">
              عرض كل التقارير بالتاريخ
            </p>
          </div>
        </div>
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* الرسوم البيانية */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          <span className="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
          الإحصائيات البيانية
        </h2>
        <DashboardCharts data={monthData} />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: any
  color: 'emerald' | 'rose' | 'purple' | 'blue' | 'amber'
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
    purple: 'text-purple-600 bg-purple-50',
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
  }
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] text-slate-500 font-medium">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-sm font-bold text-slate-800">{formatCurrency(value)}</p>
    </div>
  )
}
