'use client'

import { useState } from 'react'
import { FileText, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, todayStr, startOfMonth } from '@/lib/format'
import {
  customerRepository,
  useLiveData,
} from '@/lib/db'
import {
  getFactorySettings,
  buildFactoryHeader,
  buildFactoryFooter,
} from '@/lib/factory-header'
import type { CustomerWithStats } from './CustomerCard'

interface CustomerReportProps {
  customer: CustomerWithStats
  onClose: () => void
}

export function CustomerReport({ customer, onClose }: CustomerReportProps) {
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  // جلب إحصائيات العميل مع التحديث الفوري
  const { data, loading, reload } = useLiveData<any>(async () => {
    const stats = await customerRepository.getWithStats(customer.id)
    if (!stats) return null
    const fromTime = from ? new Date(from).getTime() : 0
    const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Date.now()
    const filteredSales = stats.sales.filter((s) => {
      const t = new Date(s.date).getTime()
      return t >= fromTime && t <= toTime
    })
    const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0)
    const totalPaid = filteredSales.reduce((sum, s) => sum + s.paid, 0)
    return {
      ...stats,
      sales: filteredSales,
      totalSales,
      totalPaid,
      totalRemaining: totalSales - totalPaid,
      salesCount: filteredSales.length,
      summary: {
        salesCount: filteredSales.length,
        totalSales,
        totalPaid,
        totalRemaining: totalSales - totalPaid,
      },
    }
  }, ['sales'])

  const exportPDF = async () => {
    if (!data) return
    setExporting(true)
    try {
      const { exportElementToPDF, shareViaWhatsApp, createReportContainer, cleanupContainer } =
        await import('@/lib/pdf-export')

      const settings = await getFactorySettings()
      const header = buildFactoryHeader(settings)
      const footer = buildFactoryFooter(settings)

      const salesRows = (data.sales || [])
        .map(
          (s: any) => `
          <tr>
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${formatDate(s.date)}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${s.invoiceNo || '-'}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${s.items?.length || 0}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center; color: #059669; font-weight: bold;">${formatCurrency(s.total)}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${formatCurrency(s.paid)}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center; color: #d97706; font-weight: bold;">${formatCurrency(s.total - s.paid)}</td>
          </tr>`
        )
        .join('')

      const contentHtml = `
        ${header}
        <div style="margin-bottom: 20px; padding: 16px; background: #f0fdf4; border-radius: 8px;">
          <h2 style="margin: 0 0 8px; color: #1e293b;">بيانات العميل</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
            <p><strong>الاسم:</strong> ${customer.name}</p>
            <p><strong>الهاتف:</strong> ${customer.phone || '-'}</p>
            <p><strong>العنوان:</strong> ${customer.address || '-'}</p>
            <p><strong>الفترة:</strong> ${formatDate(from)} إلى ${formatDate(to)}</p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="padding: 12px; background: #f0fdf4; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #047857;">عدد الفواتير</p>
            <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold; color: #065f46;">${data.summary.salesCount}</p>
          </div>
          <div style="padding: 12px; background: #fef3c7; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #92400e;">إجمالي المبيعات</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #78350f;">${formatCurrency(data.summary.totalSales)}</p>
          </div>
          <div style="padding: 12px; background: #dbeafe; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #1e40af;">المدفوع</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #1e3a8a;">${formatCurrency(data.summary.totalPaid)}</p>
          </div>
          <div style="padding: 12px; background: #fee2e2; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #b91c1c;">المتبقي</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #7f1d1d;">${formatCurrency(data.summary.totalRemaining)}</p>
          </div>
        </div>
        <h3 style="color: #1e293b; margin: 16px 0 8px;">تفاصيل الفواتير</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 8px; border: 1px solid #e2e8f0;">التاريخ</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">رقم الفاتورة</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">عدد الأصناف</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">الإجمالي</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">المدفوع</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            ${salesRows || '<tr><td colspan="6" style="padding: 12px; text-align: center; color: #94a3b8;">لا توجد فواتير في هذه الفترة</td></tr>'}
          </tbody>
        </table>
        ${footer}
      `

      const container = createReportContainer(`تقرير العميل: ${customer.name}`, contentHtml)
      await new Promise((r) => setTimeout(r, 100))
      const file = await exportElementToPDF(container, `تقرير-العميل-${customer.name}.pdf`)
      cleanupContainer(container)

      toast({ title: 'تم', description: 'تم إنشاء PDF - جارٍ المشاركة عبر الواتساب' })
      await shareViaWhatsApp(file, `تقرير العميل: ${customer.name}\nالفترة: ${formatDate(from)} إلى ${formatDate(to)}`)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            تقرير العميل: {customer.name}
          </DialogTitle>
          <DialogDescription className="sr-only">إدارة بيانات العملاء</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">من تاريخ</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-slate-50 text-sm" />
            </div>
            <div>
              <Label className="text-[10px]">إلى تاريخ</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-slate-50 text-sm" />
            </div>
          </div>
          <Button onClick={reload} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="sm">
            {loading ? 'جارٍ التحميل...' : 'عرض التقرير'}
          </Button>

          {data && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-emerald-700">عدد الفواتير</p>
                  <p className="font-bold text-emerald-900">{data.summary.salesCount}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-amber-700">إجمالي المبيعات</p>
                  <p className="font-bold text-amber-900">{formatCurrency(data.summary.totalSales)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-blue-700">المدفوع</p>
                  <p className="font-bold text-blue-900">{formatCurrency(data.summary.totalPaid)}</p>
                </div>
                <div className="bg-rose-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-rose-700">المتبقي</p>
                  <p className="font-bold text-rose-900">{formatCurrency(data.summary.totalRemaining)}</p>
                </div>
              </div>

              {data.sales?.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-lg max-h-60 overflow-y-auto">
                  {data.sales.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-2 border-b border-slate-50 text-xs last:border-0">
                      <div>
                        <p className="font-medium text-slate-800">{formatDate(s.date)}</p>
                        <p className="text-[10px] text-slate-500">{s.items?.length || 0} صنف</p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-emerald-700">{formatCurrency(s.total)}</p>
                        <p className="text-[10px] text-amber-600">متبقي: {formatCurrency(s.total - s.paid)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={exportPDF}
                disabled={exporting}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
              >
                <TrendingUp className="w-4 h-4 ml-1" />
                {exporting ? 'جارٍ التصدير...' : 'تصدير PDF ومشاركة واتساب'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
