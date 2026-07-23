/**
 * تصدير البيانات بصيغة Word (docx)
 * يعمل بدون مكتبات خارجية - يولّد ملف docx بصيغة HTML
 */

import type { FactorySettings } from '@/lib/db/types'

interface ExportOptions {
  title: string
  factorySettings?: FactorySettings
  content: string // HTML content
  fileName?: string
}

/**
 * تصدير HTML إلى ملف Word (.doc)
 * يستخدم صيغة MHTML التي يدعمها Word
 */
export function exportToWord({ title, factorySettings, content, fileName }: ExportOptions): void {
  const now = new Date().toLocaleString('ar-EG')

  // ترويسة المصنع (لو موجودة)
  const factoryHeader = factorySettings?.factoryName
    ? `
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">
        ${factorySettings.logo ? `<img src="${factorySettings.logo}" style="max-height: 80px; max-width: 200px; margin-bottom: 8px;" />` : ''}
        <h1 style="margin: 0; color: #0f172a; font-size: 22px;">${factorySettings.factoryName}</h1>
        ${factorySettings.slogan ? `<p style="margin: 4px 0; color: #64748b; font-size: 12px;">${factorySettings.slogan}</p>` : ''}
        <div style="margin-top: 6px; font-size: 11px; color: #475569;">
          ${factorySettings.phone ? `📞 ${factorySettings.phone}` : ''}
          ${factorySettings.address ? ` • 📍 ${factorySettings.address}` : ''}
          ${factorySettings.taxNumber ? ` • سجل ضريبي: ${factorySettings.taxNumber}` : ''}
        </div>
      </div>
    `
    : ''

  const html = `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>90</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: A4;
          margin: 1.5cm;
        }
        body {
          font-family: 'Calibri', 'Tahoma', 'Arial', sans-serif;
          direction: rtl;
          font-size: 12pt;
          color: #1e293b;
        }
        h1 { color: #0f172a; font-size: 18pt; margin: 0 0 8pt 0; }
        h2 { color: #334155; font-size: 14pt; margin: 16pt 0 8pt 0; }
        h3 { color: #475569; font-size: 12pt; margin: 12pt 0 6pt 0; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 8pt 0;
          font-size: 10pt;
        }
        th {
          background: #0f172a;
          color: white;
          padding: 6pt;
          border: 1px solid #0f172a;
          text-align: right;
          font-weight: bold;
        }
        td {
          padding: 4pt 6pt;
          border: 1px solid #cbd5e1;
          text-align: right;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        .total-row td {
          background: #f1f5f9 !important;
          font-weight: bold;
        }
        .header {
          text-align: center;
          border-bottom: 2pt solid #0f172a;
          padding-bottom: 10pt;
          margin-bottom: 15pt;
        }
        .footer {
          margin-top: 20pt;
          padding-top: 10pt;
          border-top: 1pt dashed #94a3b8;
          text-align: center;
          font-size: 9pt;
          color: #64748b;
        }
        .info-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 8pt;
          margin: 8pt 0;
          border-radius: 4pt;
        }
        .stat-grid {
          display: table;
          width: 100%;
          margin: 10pt 0;
        }
        .stat-cell {
          display: table-cell;
          width: 25%;
          padding: 8pt;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
      </style>
    </head>
    <body>
      ${factoryHeader}

      <div style="text-align: center; margin-bottom: 15pt;">
        <h1 style="font-size: 20pt; color: #0f172a;">${title}</h1>
        <p style="color: #64748b; font-size: 10pt;">تاريخ التقرير: ${now}</p>
      </div>

      ${content}

      <div class="footer">
        <p>تم إنشاء هذا التقرير بواسطة Selim ERP - ${now}</p>
        ${factorySettings?.factoryName ? `<p>${factorySettings.factoryName}</p>` : ''}
      </div>
    </body>
    </html>
  `

  // إنشاء ملف Word
  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName || title}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * تصدير بيانات بسيطة كجدول Word
 */
export function exportTableToWord(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  factorySettings?: FactorySettings
): void {
  const tableHtml = `
    <table>
      <thead>
        <tr>
          ${headers.map((h) => `<th>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row, i) =>
              `<tr${i === rows.length - 1 && row[0]?.toString().includes('الإجمالي') ? ' class="total-row"' : ''}>
                ${row.map((cell) => `<td>${cell}</td>`).join('')}
              </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `

  exportToWord({
    title,
    factorySettings,
    content: tableHtml,
    fileName: `${title}.doc`,
  })
}
