'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReportData } from '@/lib/db'
import { ExcelExportButton, type ExcelSheet } from '../ExcelExportButton'
import { PrintButton } from '../PrintButton'

interface ExportButtonsProps {
  data: ReportData
  from: string
  to: string
  exporting: boolean
  exportingWord: boolean
  onExportPDF: () => void
  onExportWord: () => void
  printHtml: string
  printText: string
}

/**
 * بناء أوراق Excel من بيانات التقرير
 * - الورقة الأولى (معلومات المصنع) تُضاف تلقائياً عبر ExcelExportButton
 *   التي تستدعي getFactorySettings() داخلياً
 */
function buildExcelSheets(data: ReportData): ExcelSheet[] {
  const s = data.summary

  // ورقة الملخص المالي
  const financialSheet: ExcelSheet = {
    name: 'الملخص المالي',
    headers: ['البند', 'القيمة'],
    rows: [
      ['إجمالي المبيعات', s.salesTotal],
      ['المحصل من المبيعات', s.salesPaid],
      ['متبقي المبيعات', s.salesRemaining],
      ['إجمالي المشتريات', s.purchasesTotal],
      ['المدفوع للموردين', s.purchasesPaid],
      ['متبقي للموردين', s.purchasesRemaining],
      ['إجمالي المصاريف', s.expensesTotal],
      ['سلف العمال', s.advancesTotal],
      ['قبض العمال', s.receiptsTotal],
      ...(s.productionTotal > 0
        ? ([
            ['إنتاج بالقطعة', s.productionTotal],
            ['عدد القطع المنتجة', s.productionPieces],
          ] as (string | number)[][])
        : []),
      ['صافي الربح', s.netProfit],
    ],
  }

  // ورقة المصاريف حسب البند
  const expensesByCategorySheet: ExcelSheet = {
    name: 'المصاريف حسب البند',
    headers: ['البند', 'المبلغ'],
    rows: Object.entries(data.expensesByCategory || {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => [name, amount]),
  }

  // ورقة أكثر الأصناف مبيعاً
  const topItemsSheet: ExcelSheet = {
    name: 'أكثر الأصناف مبيعاً',
    headers: ['الصنف', 'الكمية', 'الإجمالي'],
    rows: (data.topItems || []).map((it) => [it.name, it.qty, it.total]),
  }

  // ورقة أكثر الموديلات إنتاجاً
  const topModelsSheet: ExcelSheet = {
    name: 'أكثر الموديلات إنتاجاً',
    headers: ['الموديل', 'الكمية', 'الإجمالي'],
    rows: (data.topModels || []).map((m) => [m.name, m.qty, m.total]),
  }

  return [financialSheet, expensesByCategorySheet, topItemsSheet, topModelsSheet]
}

/**
 * أزرار تصدير التقرير: PDF + Word + Excel + Print
 */
export function ExportButtons({
  data,
  from,
  to,
  exporting,
  exportingWord,
  onExportPDF,
  onExportWord,
  printHtml,
  printText,
}: ExportButtonsProps) {
  // بناء الأوراق مرة واحدة لكل تصدير (تتحدث تلقائياً مع تغير data)
  // ExcelExportButton داخلياً يستدعي factorySettingsRepository.get()
  // وهو مكافئ لـ await getFactorySettings() - يضيف بيانات المصنع كأول ورقة
  const sheets = buildExcelSheets(data)

  return (
    <>
      {/* تصدير PDF */}
      <Button
        onClick={onExportPDF}
        disabled={exporting || !data}
        className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
        size="sm"
      >
        <Download className="w-4 h-4 ml-1" />
        {exporting ? 'جارٍ التصدير...' : 'تصدير PDF ومشاركة واتساب'}
      </Button>

      {/* تصدير Word */}
      <Button
        onClick={onExportWord}
        disabled={exportingWord || !data}
        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
        size="sm"
      >
        📄 {exportingWord ? 'جارٍ التصدير...' : 'تصدير Word'}
      </Button>

      {/* تصدير Excel - يضيف بيانات المصنع تلقائياً كأول ورقة */}
      <ExcelExportButton
        title="التقرير الشامل للمصنع"
        fileName={`تقرير-شامل-${from}-إلى-${to}`}
        sheets={sheets}
        label="📊 تصدير Excel"
        size="sm"
        className="w-full"
        disabled={!data}
        includeFactoryInfo={true}
      />

      {/* طباعة */}
      {printHtml && (
        <PrintButton
          contentHtml={printHtml}
          title="التقرير الشامل"
          plainText={printText}
          variant="outline"
          size="sm"
          className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          label="🖨️ طباعة التقرير"
        />
      )}
    </>
  )
}
