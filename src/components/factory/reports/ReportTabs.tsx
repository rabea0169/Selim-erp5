'use client'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/format'
import type { ReportData } from '@/lib/db'
import { TransactionList } from './TransactionList'

interface ReportTabsProps {
  data: ReportData
}

/**
 * تبويبات التقرير: ملخص / مبيعات / مشتريات / عمال / مصاريف
 */
export function ReportTabs({ data }: ReportTabsProps) {
  return (
    <Tabs defaultValue="summary" dir="rtl">
      <TabsList className="grid grid-cols-5 w-full bg-slate-100 h-9">
        <TabsTrigger value="summary" className="text-[11px]">ملخص</TabsTrigger>
        <TabsTrigger value="sales" className="text-[11px]">المبيعات</TabsTrigger>
        <TabsTrigger value="purchases" className="text-[11px]">المشتريات</TabsTrigger>
        <TabsTrigger value="workers" className="text-[11px]">العمال</TabsTrigger>
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
            <Row label="سلف العمال" value={formatCurrency(data.summary.advancesTotal)} color="purple" />
            <Row label="قبض العمال" value={formatCurrency(data.summary.receiptsTotal)} color="emerald" />
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

      {/* Workers tab */}
      <TabsContent value="workers" className="mt-3 space-y-3">
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
