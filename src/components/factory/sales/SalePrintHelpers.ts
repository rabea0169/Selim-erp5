// مساعدات طباعة فواتير المبيعات - تشمل ترويسة وتذييل المصنع

import { formatCurrency, formatDate } from '@/lib/format'
import { getFactorySettings, buildFactoryHeader, buildFactoryFooter } from '@/lib/factory-header'
import { escapeHtml } from '@/lib/utils'
import type { Sale } from '@/lib/db'

/**
 * بناء HTML لطباعة فاتورة المبيعات - مع ترويسة وتذييل المصنع
 */
export async function buildSalePrintHtml(sale: Sale): Promise<string> {
  const settings = await getFactorySettings()
  const header = buildFactoryHeader(settings)
  const footer = buildFactoryFooter(settings)

  const itemsRows = sale.items
    .map(
      (it, i) =>
        `<tr><td style="padding: 4px 6px; border: 1px solid #000; text-align: center;">${i + 1}</td><td style="padding: 4px 6px; border: 1px solid #000;">${escapeHtml(it.itemName)}</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: center;">${it.quantity}</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: left;">${formatCurrency(it.unitPrice)}</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: left; font-weight: bold;">${formatCurrency(it.total)}</td></tr>`
    )
    .join('')

  return `
    ${header}
    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
      <h1 style="margin: 0; font-size: 18px;">فاتورة مبيعات</h1>
    </div>
    <table style="width: 100%; font-size: 12px; margin-bottom: 12px;">
      <tr><td style="padding: 2px 0;">العميل:</td><td style="font-weight: bold;">${escapeHtml(sale.customerName)}</td></tr>
      ${sale.invoiceNo ? `<tr><td style="padding: 2px 0;">رقم الفاتورة:</td><td>${escapeHtml(sale.invoiceNo)}</td></tr>` : ''}
      <tr><td style="padding: 2px 0;">التاريخ:</td><td>${formatDate(sale.date)}</td></tr>
    </table>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
      <thead><tr style="background: #f0f0f0;"><th style="padding: 6px; border: 1px solid #000;">#</th><th style="padding: 6px; border: 1px solid #000;">الصنف</th><th style="padding: 6px; border: 1px solid #000;">كمية</th><th style="padding: 6px; border: 1px solid #000;">سعر</th><th style="padding: 6px; border: 1px solid #000;">إجمالي</th></tr></thead>
      <tbody>${itemsRows}</tbody>
      <tfoot>
        <tr style="background: #f8f8f8;"><td colspan="4" style="padding: 6px; border: 1px solid #000; text-align: left; font-weight: bold;">الإجمالي:</td><td style="padding: 6px; border: 1px solid #000; text-align: left; font-weight: bold; color: #059669;">${formatCurrency(sale.total)}</td></tr>
        <tr><td colspan="4" style="padding: 4px 6px; border: 1px solid #000; text-align: left;">المدفوع:</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: left;">${formatCurrency(sale.paid)}</td></tr>
        <tr><td colspan="4" style="padding: 4px 6px; border: 1px solid #000; text-align: left; font-weight: bold;">المتبقي:</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: left; font-weight: bold; color: #d97706;">${formatCurrency(sale.total - sale.paid)}</td></tr>
      </tfoot>
    </table>
    ${sale.notes ? `<p style="font-size: 11px; color: #475569; margin: 8px 0;"><strong>ملاحظات:</strong> ${escapeHtml(sale.notes)}</p>` : ''}
    ${footer}
  `
}
