'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Calendar,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PrintButton } from './PrintButton'
import { Label } from '@/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, todayStr, startOfMonth } from '@/lib/format'
import {
  reportRepository,
  workerRepository,
  useLiveData,
  type ReportData,
  type FactorySettings,
} from '@/lib/db'
import {
  getFactorySettings,
  buildFactoryHeader,
  buildFactoryFooter,
} from '@/lib/factory-header'
import { exportToWord } from '@/lib/word-export'
import {
  buildPrintHtml,
  buildPrintText,
  buildReportContentHtml,
} from './reports/ReportPrintHelpers'
import { SummaryCard } from './reports/SummaryCard'
import { TransactionList } from './reports/TransactionList'

// تحميل التقرير الشامل + أسماء العمال
async function fetchReport(from: string, to: string): Promise<ReportData> {
  const [res, workers] = await Promise.all([
    reportRepository.getFullReport(from || undefined, to || undefined),
    workerRepository.getAll(),
  ])
  const workerMap = new Map(workers.map((w) => [w.id, w]))
  // إرفاق اسم العامل بسجلات السلف والقبض والإنتاج والحضور لعرضها في القوائم
  const withWorker = <T extends { workerId: string }>(arr: T[]): (T & { worker?: { id: string; name: string } })[] =>
    arr.map((x) => ({
      ...x,
      worker: workerMap.get(x.workerId)
        ? { id: workerMap.get(x.workerId)!.id, name: workerMap.get(x.workerId)!.name }
        : undefined,
    }))
  const enriched: ReportData = {
    ...res,
    advances: withWorker(res.advances) as any,
    receipts: withWorker(res.receipts) as any,
    productions: withWorker(res.productions) as any,
    attendance: withWorker(res.attendance) as any,
  }
  return enriched
}

export function ReportsView() {
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [exporting, setExporting] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)
  const [printHtml, setPrintHtml] = useState('')
  const [factorySettings, setFactorySettings] = useState<FactorySettings | null>(null)
  const { toast } = useToast()

  // تحميل التقرير مع التحديث الفوري عند تغير أي بيانات
  const { data, loading, reload } = useLiveData<ReportData>(
    () => fetchReport(from, to),
    ['sales', 'purchases', 'expenses', 'workerAdvances', 'workerReceipts', 'production', 'workers']
  )

  // إعادة التحميل عند تغير التاريخ
  useEffect(() => {
    reload()
  }, [from, to, reload])

  // تحضير HTML للطباعة + جلب إعدادات المصنع عند تغير البيانات
  useEffect(() => {
    let cancelled = false
    async function prepare() {
      if (!data) return
      try {
        const settings = await getFactorySettings()
        if (!cancelled) {
          setFactorySettings(settings)
          setPrintHtml(buildPrintHtml(data, from, to, settings))
        }
      } catch (e) {
        console.error(e)
      }
    }
    prepare()
    return () => {
      cancelled = true
    }
  }, [data, from, to])

  const setPreset = (preset: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date()
    const today = todayStr()
    let start = ''
    if (preset === 'today') start = today
    else if (preset === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      start = d.toISOString().split('T')[0]
    } else if (preset === 'month') start = startOfMonth()
    else if (preset === 'year') start = `${now.getFullYear()}-01-01`
    setFrom(start)
    setTo(today)
  }

  const handlePrint = () => {
    window.print()
  }

  const exportPDF = async () => {
    if (!data) return
    setExporting(true)
    try {
      const { exportElementToPDF, shareViaWhatsApp, createReportContainer, cleanupContainer } =
        await import('@/lib/pdf-export')

      const settings = await getFactorySettings()
      const header = buildFactoryHeader(settings)
      const footer = buildFactoryFooter(settings)

      // محتوى التقرير + ترويسة وتذييل المصنع
      const contentHtml = `${header}${buildReportContentHtml(data, from, to)}${footer}`

      const container = createReportContainer('التقرير الشامل للمصنع', contentHtml)
      await new Promise((r) => setTimeout(r, 100))
      const file = await exportElementToPDF(container, `تقرير-شامل-${from}-إلى-${to}.pdf`)
      cleanupContainer(container)

      toast({ title: 'تم', description: 'تم إنشاء PDF - جارٍ المشاركة عبر الواتساب' })
      await shareViaWhatsApp(file, `تقرير المصنع الشامل\nالفترة: ${formatDate(from)} إلى ${formatDate(to)}\nصافي الربح: ${formatCurrency(data.summary.netProfit)}`)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const exportWord = async () => {
    if (!data) return
    setExportingWord(true)
    try {
      const settings = await getFactorySettings()
      const content = buildReportContentHtml(data, from, to)
      exportToWord({
        title: 'التقرير الشامل للمصنع',
        factorySettings: settings,
        content,
        fileName: `تقرير-شامل-${from}-إلى-${to}`,
      })
      toast({ title: 'تم', description: 'تم تصدير التقرير بصيغة Word' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setExportingWord(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">التقارير</h2>
        <p className="text-xs text-slate-500">تقارير شاملة بالتاريخ المحدد</p>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-slate-500">من تاريخ</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-slate-50 border-slate-200 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500">إلى تاريخ</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-slate-50 border-slate-200 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreset('today')}
            className="h-7 text-[11px]"
          >
            اليوم
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreset('week')}
            className="h-7 text-[11px]"
          >
            آخر أسبوع
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreset('month')}
            className="h-7 text-[11px]"
          >
            هذا الشهر
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreset('year')}
            className="h-7 text-[11px]"
          >
            هذا العام
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={reload}
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
          >
            <FileText className="w-4 h-4 ml-1" />
            {loading ? 'جارٍ التحديث...' : 'عرض التقرير'}
          </Button>
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="border-slate-200"
          >
            <Download className="w-4 h-4 ml-1" />
            طباعة
          </Button>
        </div>

        <Button
          onClick={exportPDF}
          disabled={exporting || !data}
          className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
          size="sm"
        >
          <Download className="w-4 h-4 ml-1" />
          {exporting ? 'جارٍ التصدير...' : 'تصدير PDF ومشاركة واتساب'}
        </Button>

        <Button
          onClick={exportWord}
          disabled={exportingWord || !data}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
          size="sm"
        >
          📄 {exportingWord ? 'جارٍ التصدير...' : 'تصدير Word'}
        </Button>

        {data && printHtml && (
          <PrintButton
            contentHtml={printHtml}
            title="التقرير الشامل"
            plainText={buildPrintText(data, from, to)}
            variant="outline"
            size="sm"
            className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            label="🖨️ طباعة التقرير"
          />
        )}
      </div>

      {data && (
        <>
          {/* Net profit hero */}
          <div
            className={`rounded-2xl p-4 shadow-md text-white ${
              data.summary.netProfit >= 0
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
                  {formatCurrency(data.summary.netProfit)}
                </p>
                <p className="text-[10px] opacity-75 mt-1">
                  من {from ? formatDate(from) : 'البداية'} إلى {to ? formatDate(to) : 'اليوم'}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                {data.summary.netProfit >= 0 ? (
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
              value={data.summary.salesTotal}
              icon={TrendingUp}
              color="emerald"
              count={data.sales.length}
            />
            <SummaryCard
              label="إجمالي المشتريات"
              value={data.summary.purchasesTotal}
              icon={TrendingDown}
              color="amber"
              count={data.purchases.length}
            />
            <SummaryCard
              label="إجمالي المصاريف"
              value={data.summary.expensesTotal}
              icon={Wallet}
              color="rose"
              count={data.expenses.length}
            />
            <SummaryCard
              label="سلف العمال"
              value={data.summary.advancesTotal}
              icon={Users}
              color="purple"
              count={data.advances.length}
            />
          </div>

          {/* Detailed tabs */}
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
        </>
      )}
    </div>
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
