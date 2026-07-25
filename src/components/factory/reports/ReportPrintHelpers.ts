// مساعدات طباعة تقارير المصنع - تشمل ترويسة وتذييل المصنع

import { formatCurrency, formatDate } from '@/lib/format'
import type { FactorySettings, ReportData } from '@/lib/db'
import { buildFactoryHeader, buildFactoryFooter } from '@/lib/factory-header'
import { escapeHtml } from '@/lib/utils'

/**
 * محتوى التقرير (بدون ترويسة/تذييل المصنع)
 * يُستخدم في تصدير Word و PDF
 */
export function buildReportContentHtml(data: ReportData, from: string, to: string): string {
  const s = data.summary

  const catRows = Object.entries(data.expensesByCategory || {})
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, amount]) =>
        `<tr><td style="padding:5px;border:1px solid #e2e8f0;">${escapeHtml(name)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:left;font-weight:bold;color:#dc2626;">${formatCurrency(amount)}</td></tr>`
    )
    .join('')

  const topItemRows = (data.topItems || [])
    .map(
      (it, i) =>
        `<tr><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${i + 1}</td><td style="padding:5px;border:1px solid #e2e8f0;">${escapeHtml(it.name)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${it.qty}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:left;font-weight:bold;color:#059669;">${formatCurrency(it.total)}</td></tr>`
    )
    .join('')

  return `
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
          <div style="display:flex;justify-content:space-between;"><span>سلف الموظفين:</span><span style="color:#dc2626;font-weight:bold;">${formatCurrency(s.advancesTotal)}</span></div>
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
}

/**
 * HTML كامل للطباعة - يشمل ترويسة وتذييل المصنع
 */
export function buildPrintHtml(
  data: ReportData,
  from: string,
  to: string,
  settings: FactorySettings
): string {
  const s = data.summary
  const header = buildFactoryHeader(settings)
  const footer = buildFactoryFooter(settings)

  const catRows = Object.entries(data.expensesByCategory || {})
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, amount]) =>
        `<tr><td style="padding: 4px 8px; border: 1px solid #000;">${escapeHtml(name)}</td><td style="padding: 4px 8px; border: 1px solid #000; text-align: left; font-weight: bold;">${formatCurrency(amount)}</td></tr>`
    )
    .join('')

  return `
    ${header}
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
      <tr><td style="padding: 4px 8px; border: 1px solid #000;">سلف الموظفين</td><td style="padding: 4px 8px; border: 1px solid #000; text-align: left; color: #dc2626; font-weight: bold;">${formatCurrency(s.advancesTotal)}</td></tr>
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
    ${footer}
  `
}

/**
 * نص التقرير بصيغة بسيطة (للطابعات الحرارية)
 */
export function buildPrintText(data: ReportData, from: string, to: string): string {
  const s = data.summary
  return `تقرير مصنع الملابس
الفترة: ${formatDate(from)} إلى ${formatDate(to)}
----------------------------
المبيعات:     ${formatCurrency(s.salesTotal)}
المشتريات:    ${formatCurrency(s.purchasesTotal)}
المصاريف:     ${formatCurrency(s.expensesTotal)}
سلف الموظفين:   ${formatCurrency(s.advancesTotal)}
${s.productionTotal > 0 ? `الإنتاج:      ${formatCurrency(s.productionTotal)}\n` : ''}----------------------------
صافي الربح:   ${formatCurrency(s.netProfit)}
----------------------------
${new Date().toLocaleString('ar-EG')}`
}
