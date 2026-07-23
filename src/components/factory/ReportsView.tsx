'use client'

import { useEffect, useState } from 'react'
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Calendar,
  Download,
  Receipt,
  Printer,
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

interface ReportData {
  range: { from: string | null; to: string | null }
  summary: {
    salesTotal: number
    salesPaid: number
    salesRemaining: number
    purchasesTotal: number
    purchasesPaid: number
    purchasesRemaining: number
    advancesTotal: number
    receiptsTotal: number
    productionTotal: number
    productionPieces: number
    expensesTotal: number
    netProfit: number
  }
  sales: any[]
  purchases: any[]
  advances: any[]
  receipts: any[]
  productions: any[]
  attendance: any[]
  expenses: any[]
  expensesByCategory: Record<string, number>
  topItems: { name: string; qty: number; total: number }[]
  topModels: { name: string; qty: number; total: number }[]
}

// بناء HTML للطباعة
function buildPrintHtml(data: ReportData, from: string, to: string): string {
  const s = data.summary
  const catRows = Object.entries(data.expensesByCategory || {})
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, amount]) =>
        `<tr><td style="padding: 4px 8px; border: 1px solid #000;">${name}</td><td style="padding: 4px 8px; border: 1px solid #000; text-align: left; font-weight: bold;">${formatCurrency(amount)}</td></tr>`
    )
    .join('')

  return `
    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
      <h1 style="margin: 0; font-size: 18px;">تقرير مصنع الملابس الشامل</h1>
      <p style="margin: 4px 0 0; font-size: 11px;">الفترة: ${formatDate(from)} إلى ${formatDate(to)}</p>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
      <tr style="background: #f0f0f0;">
        <th style="padding: 6px; border: 1px solid #000; text-align: right;">البند</th>
        <th style="padding: 6px; border: 1px solid #000; text-align: left;">القيمة</th>
      </tr>
      <tr><td style="padding: 4px 8px; border: 1px solid #000;">إجمالي المبيعات</td><td style="padding: 4px 8px; border: 1px solid #000; text-align: left; color: #059669; font-weight: bold;">${formatCurrency(s.salesTotal)}</td></tr>
      <tr><td style="padding: 4px 8px; border: 1px solid #000;">إجمالي المشتريات</td><td style="padding: 4px 8px; border: 1px solid #000; text-align: left; color: #d97706; font-weight: bold;">${formatCurrency(s.purchasesTotal)}</td></tr>
      <tr><td style="padding: 4px 8px; border: 1px solid #000;">إجمالي المصاريف</td><td style="padding: 4px 8px; border: 1px solid #000; text-align: left; color: #dc2626; font-weight: bold;">${formatCurrency(s.expensesTotal)}</td></tr>
      <tr><td style="padding: 4px 8px; border: 1px solid #000;">سلف العمال</td><td style="padding: 4px 8px; border: 1px solid #000; text-align: left; color: #dc2626; font-weight: bold;">${formatCurrency(s.advancesTotal)}</td></tr>
      ${s.productionTotal > 0 ? `<tr><td style="padding: 4px 8px; border: 1px solid #000;">إنتاج بالقطعة</td><td style="padding: 4px 8px; border: 1px solid #000; text-align: left; color: #4f46e5; font-weight: bold;">${formatCurrency(s.productionTotal)}</td></tr>` : ''}
      <tr style="background: ${s.netProfit >= 0 ? '#dcfce7' : '#fee2e2'};">
        <td style="padding: 8px; border: 2px solid #000; font-weight: bold; font-size: 14px;">صافي الربح</td>
        <td style="padding: 8px; border: 2px solid #000; text-align: left; font-weight: bold; font-size: 14px; color: ${s.netProfit >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(s.netProfit)}</td>
      </tr>
    </table>
    ${catRows ? `
    <h3 style="font-size: 13px; margin: 12px 0 6px;">المصاريف حسب البند</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead><tr style="background: #fee2e2;"><th style="padding: 6px; border: 1px solid #000;">البند</th><th style="padding: 6px; border: 1px solid #000;">المبلغ</th></tr></thead>
      <tbody>${catRows}</tbody>
    </table>` : ''}
    <div style="margin-top: 16px; padding-top: 8px; border-top: 1px dashed #000; text-align: center; font-size: 10px; color: #666;">
      تم إنشاء التقرير: ${new Date().toLocaleString('ar-EG')}
    </div>
  `
}

function buildPrintText(data: ReportData, from: string, to: string): string {
  const s = data.summary
  return `تقرير مصنع الملابس
الفترة: ${formatDate(from)} إلى ${formatDate(to)}
----------------------------
المبيعات:     ${formatCurrency(s.salesTotal)}
المشتريات:    ${formatCurrency(s.purchasesTotal)}
المصاريف:     ${formatCurrency(s.expensesTotal)}
سلف العمال:   ${formatCurrency(s.advancesTotal)}
${s.productionTotal > 0 ? `الإنتاج:      ${formatCurrency(s.productionTotal)}\n` : ''}----------------------------
صافي الربح:   ${formatCurrency(s.netProfit)}
----------------------------
${new Date().toLocaleString('ar-EG')}`
}

export function ReportsView() {
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?from=${from}&to=${to}`).then((r) => r.json())
      setData(res)
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل التقرير', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      const s = data.summary
      const catRows = Object.entries(data.expensesByCategory || {})
        .sort((a, b) => b[1] - a[1])
        .map(
          ([name, amount]) =>
            `<tr><td style="padding:5px;border:1px solid #e2e8f0;">${name}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:left;font-weight:bold;color:#dc2626;">${formatCurrency(amount)}</td></tr>`
        )
        .join('')

      const topItemRows = (data.topItems || [])
        .map(
          (it, i) =>
            `<tr><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${i + 1}</td><td style="padding:5px;border:1px solid #e2e8f0;">${it.name}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${it.qty}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:left;font-weight:bold;color:#059669;">${formatCurrency(it.total)}</td></tr>`
        )
        .join('')

      const contentHtml = `
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
          <div style="padding:16px;background:${s.netProfit >= 0 ? '#f0fdf4' : '#fef2f2'};border-radius:8px;text-align:center;">
            <p style="margin:0;font-size:12px;color:${s.netProfit >= 0 ? '#047857' : '#991b1b'};">صافي الربح للفترة</p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:bold;color:${s.netProfit >= 0 ? '#065f46' : '#7f1d1d'};">${formatCurrency(s.netProfit)}</p>
            <p style="margin:4px 0 0;font-size:10px;color:#64748b;">${from ? formatDate(from) : 'البداية'} إلى ${to ? formatDate(to) : 'اليوم'}</p>
          </div>
          <div style="padding:16px;background:#f8fafc;border-radius:8px;">
            <p style="margin:0 0 8px;font-size:12px;color:#475569;font-weight:bold;">ملخص العمليات</p>
            <div style="font-size:11px;line-height:1.8;">
              <div style="display:flex;justify-content:space-between;"><span>المبيعات:</span><span style="color:#059669;font-weight:bold;">${formatCurrency(s.salesTotal)}</span></div>
              <div style="display:flex;justify-content:space-between;"><span>المشتريات:</span><span style="color:#d97706;font-weight:bold;">${formatCurrency(s.purchasesTotal)}</span></div>
              <div style="display:flex;justify-content:space-between;"><span>المصاريف:</span><span style="color:#dc2626;font-weight:bold;">${formatCurrency(s.expensesTotal)}</span></div>
              <div style="display:flex;justify-content:space-between;"><span>سلف العمال:</span><span style="color:#dc2626;font-weight:bold;">${formatCurrency(s.advancesTotal)}</span></div>
              ${s.productionTotal > 0 ? `<div style="display:flex;justify-content:space-between;"><span>إنتاج بالقطعة:</span><span style="color:#4f46e5;font-weight:bold;">${formatCurrency(s.productionTotal)}</span></div>` : ''}
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px;">
          <div style="padding:10px;background:#ecfdf5;border-radius:6px;text-align:center;"><p style="margin:0;font-size:10px;color:#047857;">مبيعات</p><p style="margin:3px 0 0;font-size:13px;font-weight:bold;color:#065f46;">${formatCurrency(s.salesTotal)}</p></div>
          <div style="padding:10px;background:#fffbeb;border-radius:6px;text-align:center;"><p style="margin:0;font-size:10px;color:#92400e;">مشتريات</p><p style="margin:3px 0 0;font-size:13px;font-weight:bold;color:#78350f;">${formatCurrency(s.purchasesTotal)}</p></div>
          <div style="padding:10px;background:#fef2f2;border-radius:6px;text-align:center;"><p style="margin:0;font-size:10px;color:#991b1b;">مصاريف</p><p style="margin:3px 0 0;font-size:13px;font-weight:bold;color:#7f1d1d;">${formatCurrency(s.expensesTotal)}</p></div>
          <div style="padding:10px;background:#f5f3ff;border-radius:6px;text-align:center;"><p style="margin:0;font-size:10px;color:#5b21b6;">سلف</p><p style="margin:3px 0 0;font-size:13px;font-weight:bold;color:#4c1d95;">${formatCurrency(s.advancesTotal)}</p></div>
        </div>
        ${catRows ? `
        <h3 style="color:#1e293b;margin:16px 0 8px;">المصاريف حسب البند</h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:#fef2f2;"><th style="padding:6px;border:1px solid #e2e8f0;">البند</th><th style="padding:6px;border:1px solid #e2e8f0;">المبلغ</th></tr></thead>
          <tbody>${catRows}</tbody>
        </table>` : ''}
        ${topItemRows ? `
        <h3 style="color:#1e293b;margin:16px 0 8px;">أكثر الأصناف مبيعاً</h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:#f0fdf4;"><th style="padding:6px;border:1px solid #e2e8f0;">#</th><th style="padding:6px;border:1px solid #e2e8f0;">الصنف</th><th style="padding:6px;border:1px solid #e2e8f0;">الكمية</th><th style="padding:6px;border:1px solid #e2e8f0;">الإجمالي</th></tr></thead>
          <tbody>${topItemRows}</tbody>
        </table>` : ''}
      `

      const container = createReportContainer('التقرير الشامل للمصنع', contentHtml)
      await new Promise((r) => setTimeout(r, 100))
      const file = await exportElementToPDF(container, `تقرير-شامل-${from}-إلى-${to}.pdf`)
      cleanupContainer(container)

      toast({ title: 'تم', description: 'تم إنشاء PDF - جارٍ المشاركة عبر الواتساب' })
      await shareViaWhatsApp(file, `تقرير المصنع الشامل\nالفترة: ${formatDate(from)} إلى ${formatDate(to)}\nصافي الربح: ${formatCurrency(s.netProfit)}`)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setExporting(false)
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
            onClick={load}
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

        {data && (
          <PrintButton
            contentHtml={buildPrintHtml(data, from, to)}
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

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  count,
}: {
  label: string
  value: number
  icon: any
  color: 'emerald' | 'rose' | 'amber' | 'purple' | 'blue'
  count: number
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  }
  return (
    <div className={`rounded-xl p-3 border ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-medium opacity-80">{label}</p>
        <Icon className="w-3.5 h-3.5 opacity-70" />
      </div>
      <p className="text-sm font-bold">{formatCurrency(value)}</p>
      <p className="text-[10px] opacity-60 mt-0.5">{count} عملية</p>
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

function TransactionList({
  items,
  empty,
  titleKey,
  amountKey,
  dateKey,
  color,
  extra,
}: {
  items: any[]
  empty: string
  titleKey: string | ((item: any) => string)
  amountKey: string
  dateKey: string
  color: 'emerald' | 'rose' | 'amber' | 'purple' | 'blue'
  extra?: (item: any) => React.ReactNode
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
    purple: 'text-purple-700',
    blue: 'text-blue-700',
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 text-center border border-slate-100">
        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500">{empty}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="max-h-96 overflow-y-auto">
        {items.map((item, i) => {
          const title = typeof titleKey === 'function' ? titleKey(item) : item[titleKey]
          const amount = item[amountKey]
          const date = item[dateKey]
          return (
            <div
              key={item.id || i}
              className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Calendar className="w-2.5 h-2.5" />
                    {formatDate(date)}
                  </span>
                  {extra && extra(item)}
                </div>
              </div>
              <p className={`text-sm font-bold ${colors[color]}`}>
                {formatCurrency(amount)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
