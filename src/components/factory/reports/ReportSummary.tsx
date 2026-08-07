'use client'

import { TrendingUp, TrendingDown, Wallet, Users } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import type { ReportData } from '@/lib/db'
import { SummaryCard } from './SummaryCard'

interface ReportSummaryProps {
  data: ReportData
  from: string
  to: string
}

/**
 * قسم ملخص التقرير: صافي الربح البطل + بطاقات الملخص الأربع
 * ملاحظة: الأعداد تأتي من summary.*Count (تجميعات السيرفر) لأن المصفوفات الخام
 * لم تعد تُرجع من الـ API (كانت تعرض صفر دائماً بعد إصلاح الأداء)
 */
export function ReportSummary({ data, from, to }: ReportSummaryProps) {
  const isProfit = data.summary.netProfit >= 0
  const s = data.summary

  return (
    <>
      {/* Net profit hero */}
      <div
        className={`rounded-2xl p-4 shadow-md text-white ${
          isProfit
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
            : 'bg-gradient-to-br from-rose-500 to-red-600'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-90">
              صافي الربح للفترة
            </p>
            <p className="text-2xl font-bold">
              {formatCurrency(s.netProfit)}
            </p>
            <p className="text-[10px] opacity-75 mt-1">
              من {from ? formatDate(from) : 'البداية'} إلى {to ? formatDate(to) : 'اليوم'}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            {isProfit ? (
              <TrendingUp className="w-7 h-7" />
            ) : (
              <TrendingDown className="w-7 h-7" />
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard
          label="إجمالي المبيعات"
          value={s.salesTotal}
          icon={TrendingUp}
          color="emerald"
          count={s.salesCount ?? data.sales.length}
        />
        <SummaryCard
          label="إجمالي المشتريات"
          value={s.purchasesTotal}
          icon={TrendingDown}
          color="amber"
          count={s.purchasesCount ?? data.purchases.length}
        />
        <SummaryCard
          label="إجمالي المصاريف"
          value={s.expensesTotal}
          icon={Wallet}
          color="rose"
          count={s.expensesCount ?? data.expenses.length}
        />
        <SummaryCard
          label="سلف الموظفين"
          value={s.advancesTotal}
          icon={Users}
          color="purple"
          count={s.advancesCount ?? data.advances.length}
        />
      </div>
    </>
  )
}
