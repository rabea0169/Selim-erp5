'use client'

import { useState, useEffect } from 'react'
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
// تصدير Excel - الزر والدالة الأساسية
import { ExcelExportButton } from './ExcelExportButton'
import { exportToExcel } from '@/lib/excel-export'
// مساعدات الطباعة (buildPrintHtml, buildPrintText, buildReportContentHtml)
import {
  buildPrintHtml,
  buildPrintText,
  buildReportContentHtml,
} from './reports/ReportPrintHelpers'
// المكونات الفرعية للتقرير
import { ReportFilters } from './reports/ReportFilters'
import { ReportSummary } from './reports/ReportSummary'
import { ExportButtons } from './reports/ExportButtons'
import { ReportTabs } from './reports/ReportTabs'

// تحميل التقرير الشامل + أسماء الموظفين
async function fetchReport(from: string, to: string): Promise<ReportData> {
  const [res, workers] = await Promise.all([
    reportRepository.getFullReport(from || undefined, to || undefined),
    workerRepository.getAll(),
  ])
  const workerMap = new Map(workers.map((w) => [w.id, w]))
  // إرفاق اسم الموظف بسجلات السلف والقبض والإنتاج والحضور لعرضها في القوائم
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

      {/* صندوق الفلاتر + أزرار التصدير (نفس الصندوق الأبيض) */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
        <ReportFilters
          from={from}
          to={to}
          loading={loading}
          onFromChange={setFrom}
          onToChange={setTo}
          onPreset={setPreset}
          onReload={reload}
          onPrint={handlePrint}
        />

        {/* أزرار التصدير: PDF + Word + Excel + Print */}
        {data && (
          <ExportButtons
            data={data}
            from={from}
            to={to}
            exporting={exporting}
            exportingWord={exportingWord}
            onExportPDF={exportPDF}
            onExportWord={exportWord}
            printHtml={printHtml}
            printText={data ? buildPrintText(data, from, to) : ''}
          />
        )}
      </div>

      {data && (
        <>
          {/* قسم الملخص: صافي الربح + البطاقات */}
          <ReportSummary data={data} from={from} to={to} />

          {/* تبويبات التفاصيل */}
          <ReportTabs data={data} />
        </>
      )}
    </div>
  )
}
