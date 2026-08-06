/**
 * تصدير البيانات بصيغة Excel (xlsx)
 */
import * as XLSX from 'xlsx'
import type { FactorySettings } from '@/lib/db/types'

interface ExportOptions {
  title: string
  factorySettings?: FactorySettings
  sheets: Array<{
    name: string
    headers: string[]
    rows: (string | number)[][]
  }>
  fileName?: string
}

export function exportToExcel({ title, factorySettings, sheets, fileName }: ExportOptions): void {
  const wb = XLSX.utils.book_new()

  // ورقة معلومات المصنع
  if (factorySettings) {
    const factoryInfo = [
      ['اسم المصنع', factorySettings.factoryName],
      ['الاسم الإنجليزي', factorySettings.factoryNameEn || ''],
      ['الشعار', factorySettings.slogan || ''],
      ['الهاتف', factorySettings.phone || ''],
      ['واتساب', factorySettings.whatsapp || ''],
      ['البريد الإلكتروني', factorySettings.email || ''],
      ['العنوان', factorySettings.address || ''],
      ['السجل الضريبي', factorySettings.taxNumber || ''],
      ['السجل التجاري', factorySettings.commercialRegister || ''],
      ['تاريخ التقرير', new Date().toLocaleString('ar-EG')],
    ]
    const ws = XLSX.utils.aoa_to_sheet(factoryInfo)
    XLSX.utils.book_append_sheet(wb, ws, 'معلومات المصنع')
  }

  // ورقة لكل مجموعة بيانات
  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows]
    const ws = XLSX.utils.aoa_to_sheet(data)

    // ضبط عرض الأعمدة والدعم العربي RTL
    const colWidths = sheet.headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...sheet.rows.map((row) => String(row[i] || '').length)
      )
      return { wch: Math.min(Math.max(maxLen + 4, 12), 50) }
    })
    ws['!cols'] = colWidths
    if (!ws['!views']) ws['!views'] = []
    ws['!views'].push({ RTL: true })

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31)) // حد Excel 31 حرف
  }

  // تنزيل الملف
  const fname = `${fileName || title}.xlsx`
  XLSX.writeFile(wb, fname)
}

// تصدير بسيط لجدول واحد
export function exportTableToExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  factorySettings?: FactorySettings
): void {
  exportToExcel({
    title,
    factorySettings,
    sheets: [{ name: title, headers, rows }],
    fileName: title,
  })
}
