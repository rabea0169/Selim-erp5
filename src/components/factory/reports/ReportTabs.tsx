'use client'

import { Clock, AlertCircle, TrendingUp } from 'lucide-react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/format'
import { formatHours, formatMinutes } from '@/lib/attendance-calc'
import type { ReportData } from '@/lib/db'
import { TransactionList } from './TransactionList'

interface ReportTabsProps {
  data: ReportData
}

interface WorkerHoursAgg {
  workerId: string
  workerName: string
  totalWorkHours: number
  totalOvertimeHours: number
  totalLateMinutes: number
  presentDays: number
}

/**
 * تجميع ساعات العمل لكل موظف من سجلات الحضور
 */
function aggregateWorkerHours(data: ReportData): WorkerHoursAgg[] {
  const map = new Map<string, WorkerHoursAgg>()

  for (const a of data.attendance || []) {
    if (a.status !== 'present') continue
    const workerId = a.workerId
    const workerName = (a as any).worker?.name || 'موظف محذوف'

    if (!map.has(workerId)) {
      map.set(workerId, {
        workerId,
        workerName,
        totalWorkHours: 0,
        totalOvertimeHours: 0,
        totalLateMinutes: 0,
        presentDays: 0,
      })
    }

    const agg = map.get(workerId)!
    // استخدام القيم المخزنة لو موجودة
    agg.totalWorkHours += a.workHours || 0
    agg.totalOvertimeHours += a.overtimeHours || 0
    agg.totalLateMinutes += a.lateMinutes || 0
    agg.presentDays += 1
  }

  return Array.from(map.values()).sort((a, b) => b.totalWorkHours - a.totalWorkHours)
}

/**
 * تبويبات التقرير: ملخص / مبيعات / مشتريات / موظفين / مصاريف
 */
export function ReportTabs({ data }: ReportTabsProps) {
  const workerHours = aggregateWorkerHours(data)
  const totalHours = workerHours.reduce((s, w) => s + w.totalWorkHours, 0)
  const totalOvertime = workerHours.reduce((s, w) => s + w.totalOvertimeHours, 0)
  const totalLate = workerHours.reduce((s, w) => s + w.totalLateMinutes, 0)

  return (
    <Tabs defaultValue="summary" dir="rtl">
      <TabsList className="grid grid-cols-5 w-full bg-slate-100 h-9">
        <TabsTrigger value="summary" className="text-[11px]">ملخص</TabsTrigger>
        <TabsTrigger value="sales" className="text-[11px]">المبيعات</TabsTrigger>
        <TabsTrigger value="purchases" className="text-[11px]">المشتريات</TabsTrigger>
        <TabsTrigger value="workers" className="text-[11px]">الموظفين</TabsTrigger>
        <TabsTrigger value="expenses" className="text-[11px]">المصاريف</TabsTrigger>
      </TabsList>

      {/* Summary tab */}
      <TabsContent value="summary" className="space-y-3 mt-3">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-700 mb-2">المالية</p>
          <div className="space-y-1.5">
            <Row label="إجمالي المبيعات" value={formatCurrency(data.summary.salesTotal)} color="emerald" />
            <Row label="المحصل من المبيعات" value={formatCurrency(data.summary.salesPaid)} color="blue" />
            <Row label="متبقي المبيعات" value={formatCurrency(data.summary.salesRemaining)} color="amber" />
            <div className="h-px bg-slate-100 my-1" />
            <Row label="إجمالي المشتريات" value={formatCurrency(data.summary.purchasesTotal)} color="amber" />
            <Row label="المدفوع للموردين" value={formatCurrency(data.summary.purchasesPaid)} color="blue" />
            <Row label="متبقي للموردين" value={formatCurrency(data.summary.purchasesRemaining)} color="rose" />
            <div className="h-px bg-slate-100 my-1" />
            <Row label="إجمالي المصاريف" value={formatCurrency(data.summary.expensesTotal)} color="rose" />
            <Row label="سلف الموظفين" value={formatCurrency(data.summary.advancesTotal)} color="purple" />
            <Row label="قبض الموظفين" value={formatCurrency(data.summary.receiptsTotal)} color="emerald" />
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="text-sm font-bold text-slate-800">صافي الربح</span>
              <span
                className={`text-sm font-bold ${
                  data.summary.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCurrency(data.summary.netProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Expenses by category */}
        {Object.keys(data.expensesByCategory).length > 0 && (
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-2">
              المصاريف حسب البند
            </p>
            <div className="space-y-1">
              {Object.entries(data.expensesByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([name, amount]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0"
                  >
                    <span className="text-slate-700">{name}</span>
                    <span className="font-bold text-rose-700">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Top selling items */}
        {data.topItems.length > 0 && (
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-2">
              أكثر الأصناف مبيعاً
            </p>
            <div className="space-y-1">
              {data.topItems.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-slate-700">{it.name}</span>
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(it.total)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {it.qty} وحدة
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      {/* Sales tab */}
      <TabsContent value="sales" className="mt-3">
        <TransactionList
          items={data.sales}
          empty="لا توجد مبيعات في هذه الفترة"
          titleKey="customerName"
          amountKey="total"
          dateKey="date"
          color="emerald"
          extra={(s) => (
            <span className="text-[10px] text-slate-500">
              {s.items?.length || 0} صنف
            </span>
          )}
        />
      </TabsContent>

      {/* Purchases tab */}
      <TabsContent value="purchases" className="mt-3">
        <TransactionList
          items={data.purchases}
          empty="لا توجد مشتريات في هذه الفترة"
          titleKey="supplierName"
          amountKey="total"
          dateKey="date"
          color="amber"
          extra={(p) => (
            <span className="text-[10px] text-slate-500">
              {p.items?.length || 0} صنف
            </span>
          )}
        />
      </TabsContent>

      {/* Workers tab - الموظفين */}
      <TabsContent value="workers" className="mt-3 space-y-3">
        {/* ملخص الساعات لكل الموظفين */}
        {workerHours.length > 0 && (
          <>
            {/* بطاقات الإجمالي */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-center">
                <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <p className="text-[10px] text-blue-700">إجمالي ساعات العمل</p>
                <p className="text-sm font-bold text-blue-900">{formatHours(totalHours)}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
                <TrendingUp className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                <p className="text-[10px] text-amber-700">إجمالي الإضافي</p>
                <p className="text-sm font-bold text-amber-900">{formatHours(totalOvertime)}</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-3 border border-rose-100 text-center">
                <AlertCircle className="w-4 h-4 text-rose-600 mx-auto mb-1" />
                <p className="text-[10px] text-rose-700">إجمالي التأخير</p>
                <p className="text-sm font-bold text-rose-900">{formatMinutes(totalLate)}</p>
              </div>
            </div>

            {/* جدول تفصيلي لكل موظف */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                ساعات العمل لكل موظف
              </p>
              <div className="space-y-1">
                {workerHours.map((w) => (
                  <div
                    key={w.workerId}
                    className="border border-slate-100 rounded-lg p-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-[10px]">
                          {w.workerName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{w.workerName}</p>
                          <p className="text-[10px] text-slate-500">{w.presentDays} يوم حضور</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <div className="bg-blue-50 rounded p-1.5 text-center">
                        <p className="text-[9px] text-blue-700">ساعات العمل</p>
                        <p className="font-bold text-blue-900">{formatHours(w.totalWorkHours)}</p>
                      </div>
                      <div className="bg-amber-50 rounded p-1.5 text-center">
                        <p className="text-[9px] text-amber-700">إضافي</p>
                        <p className={`font-bold ${w.totalOvertimeHours > 0 ? 'text-amber-900' : 'text-slate-400'}`}>
                          {w.totalOvertimeHours > 0 ? formatHours(w.totalOvertimeHours) : '-'}
                        </p>
                      </div>
                      <div className="bg-rose-50 rounded p-1.5 text-center">
                        <p className="text-[9px] text-rose-700">تأخير</p>
                        <p className={`font-bold ${w.totalLateMinutes > 0 ? 'text-rose-900' : 'text-slate-400'}`}>
                          {w.totalLateMinutes > 0 ? formatMinutes(w.totalLateMinutes) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* قوائم السلف والقبض */}
        <div>
          <p className="text-xs font-bold text-rose-700 mb-2">السلف</p>
          <TransactionList
            items={data.advances}
            empty="لا توجد سلف في هذه الفترة"
            titleKey={(a) => a.worker?.name || ''}
            amountKey="amount"
            dateKey="date"
            color="rose"
            extra={(a) => a.notes && <span className="text-[10px] text-slate-500">{a.notes}</span>}
          />
        </div>
        <div>
          <p className="text-xs font-bold text-emerald-700 mb-2">القبض</p>
          <TransactionList
            items={data.receipts}
            empty="لا يوجد قبض في هذه الفترة"
            titleKey={(r) => r.worker?.name || ''}
            amountKey="amount"
            dateKey="date"
            color="emerald"
            extra={(r) => r.notes && <span className="text-[10px] text-slate-500">{r.notes}</span>}
          />
        </div>
      </TabsContent>

      {/* Expenses tab */}
      <TabsContent value="expenses" className="mt-3">
        <TransactionList
          items={data.expenses}
          empty="لا توجد مصاريف في هذه الفترة"
          titleKey="categoryName"
          amountKey="amount"
          dateKey="date"
          color="rose"
          extra={(e) => e.notes && <span className="text-[10px] text-slate-500">{e.notes}</span>}
        />
      </TabsContent>
    </Tabs>
  )
}

function Row({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'emerald' | 'rose' | 'amber' | 'purple' | 'blue'
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
    purple: 'text-purple-700',
    blue: 'text-blue-700',
  }
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-slate-600">{label}</span>
      <span className={`font-bold ${colors[color]}`}>{value}</span>
    </div>
  )
}
