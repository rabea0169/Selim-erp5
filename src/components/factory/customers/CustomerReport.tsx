'use client'

import { useState } from 'react'
import { FileText, TrendingUp, CreditCard, RotateCcw, ArrowDownToLine, ArrowUpFromLine, Wallet, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  paymentRepository,
  saleReturnRepository,
  useLiveData,
  type Payment,
  type SaleReturn,
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

interface StatementEntry {
  id: string
  date: string
  description: string
  type: 'sale' | 'payment' | 'return'
  debit: number
  credit: number
  balance: number
}

export function CustomerReport({ customer, onClose }: CustomerReportProps) {
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const { data, loading, reload } = useLiveData<any>(async () => {
    const [stats, payments, allReturns] = await Promise.all([
      customerRepository.getWithStats(customer.id),
      paymentRepository.getByParty(customer.id),
      saleReturnRepository.getByDateRange(),
    ])

    if (!stats) return null

    const customerPayments = payments
      .filter((p) => p.type === 'customer_payment')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const customerReturns = allReturns
      .filter((r) => r.customerId_ref === customer.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const fromTime = from ? new Date(from).getTime() : 0
    const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Date.now()

    const filteredSales = stats.sales.filter((s) => {
      const t = new Date(s.date).getTime()
      return t >= fromTime && t <= toTime
    })
    const filteredPayments = customerPayments.filter((p) => {
      const t = new Date(p.date).getTime()
      return t >= fromTime && t <= toTime
    })
    const filteredReturns = customerReturns.filter((r) => {
      const t = new Date(r.date).getTime()
      return t >= fromTime && t <= toTime
    })

    const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0)
    const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
    const totalReturns = filteredReturns.reduce((sum, r) => sum + r.total, 0)
    const totalRemaining = totalSales - totalPaid - totalReturns

    // بناء كشف الحساب
    const statementEntries: StatementEntry[] = []
    let runningBalance = 0

    type AnyEntry =
      | { kind: 'sale'; date: string; id: string; total: number; invoiceNo?: string }
      | { kind: 'payment'; date: string; id: string; amount: number; method?: string }
      | { kind: 'return'; date: string; id: string; total: number; returnNumber: string }

    const allEntries: AnyEntry[] = [
      ...filteredSales.map((s) => ({ kind: 'sale' as const, date: s.date, id: s.id, total: s.total, invoiceNo: s.invoiceNo })),
      ...filteredPayments.map((p) => ({ kind: 'payment' as const, date: p.date, id: p.id, amount: p.amount, method: p.method })),
      ...filteredReturns.map((r) => ({ kind: 'return' as const, date: r.date, id: r.id, total: r.total, returnNumber: r.returnNumber })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    for (const entry of allEntries) {
      let debit = 0
      let credit = 0
      let description = ''
      let type: StatementEntry['type'] = 'sale'

      if (entry.kind === 'sale') {
        debit = entry.total
        description = `فاتورة مبيعات ${entry.invoiceNo ? `(${entry.invoiceNo})` : ''}`
        type = 'sale'
      } else if (entry.kind === 'payment') {
        credit = entry.amount
        const methodLabel = entry.method === 'transfer' ? ' - تحويل' : entry.method === 'card' ? ' - بطاقة' : ''
        description = `سداد${methodLabel}`
        type = 'payment'
      } else {
        credit = entry.total
        description = `مرتجع (${entry.returnNumber})`
        type = 'return'
      }

      runningBalance += debit - credit
      statementEntries.push({
        id: entry.id,
        date: entry.date,
        description,
        type,
        debit,
        credit,
        balance: runningBalance,
      })
    }

    return {
      ...stats,
      sales: filteredSales,
      payments: filteredPayments,
      returns: filteredReturns,
      statement: statementEntries,
      totalSales,
      totalPaid,
      totalReturns,
      totalRemaining,
      salesCount: filteredSales.length,
      paymentsCount: filteredPayments.length,
      returnsCount: filteredReturns.length,
      summary: {
        salesCount: filteredSales.length,
        paymentsCount: filteredPayments.length,
        returnsCount: filteredReturns.length,
        totalSales,
        totalPaid,
        totalReturns,
        totalRemaining,
      },
    }
  }, ['sales', 'payments', 'saleReturns'])

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

      const statementRows = (data.statement || [])
        .map(
          (s: StatementEntry) => `
          <tr>
            <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">${formatDate(s.date)}</td>
            <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: right; font-size: 11px;">${s.description}</td>
            <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: ${s.debit > 0 ? '#059669' : '#94a3b8'}; font-weight: ${s.debit > 0 ? 'bold' : 'normal'};">${s.debit > 0 ? formatCurrency(s.debit) : '-'}</td>
            <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: ${s.credit > 0 ? '#d97706' : '#94a3b8'}; font-weight: ${s.credit > 0 ? 'bold' : 'normal'};">${s.credit > 0 ? formatCurrency(s.credit) : '-'}</td>
            <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px; font-weight: bold;">${formatCurrency(s.balance)}</td>
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
        <h3 style="color: #1e293b; margin: 16px 0 8px;">كشف حساب العميل</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 8px; border: 1px solid #e2e8f0;">التاريخ</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">البيان</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">مدين (عليه)</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">دائن (له)</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0;">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            ${statementRows || '<tr><td colspan="5" style="padding: 12px; text-align: center; color: #94a3b8;">لا توجد عمليات في هذه الفترة</td></tr>'}
          </tbody>
        </table>
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
      await shareViaWhatsApp(file, `تقرير العميل: ${customer.name}\nالفترة: ${formatDate(from)} إلى ${formatDate(to)}\nالمتبقي: ${formatCurrency(data.summary.totalRemaining)}`)
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
          <DialogDescription className="sr-only">تقرير شامل للعميل يشمل كشف الحساب والسدادات</DialogDescription>
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
              {/* بطاقات الملخص */}
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

              {(data.summary.totalReturns || 0) > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-rose-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-rose-700">إجمالي المرتجعات</p>
                    <p className="font-bold text-rose-900">{formatCurrency(data.summary.totalReturns)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-blue-700">عدد السدادات</p>
                    <p className="font-bold text-blue-900">{data.summary.paymentsCount}</p>
                  </div>
                </div>
              )}

              {/* التبويبات */}
              <Tabs defaultValue="statement" dir="rtl">
                <TabsList className="w-full grid grid-cols-4 h-9">
                  <TabsTrigger value="statement" className="text-[10px]">
                    <Wallet className="w-3 h-3 ml-0.5" />
                    كشف حساب
                  </TabsTrigger>
                  <TabsTrigger value="sales" className="text-[10px]">
                    <ShoppingCart className="w-3 h-3 ml-0.5" />
                    الفواتير
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="text-[10px]">
                    <CreditCard className="w-3 h-3 ml-0.5" />
                    السدادات
                  </TabsTrigger>
                  <TabsTrigger value="returns" className="text-[10px]">
                    <RotateCcw className="w-3 h-3 ml-0.5" />
                    المرتجعات
                  </TabsTrigger>
                </TabsList>

                {/* كشف الحساب */}
                <TabsContent value="statement">
                  {data.statement?.length > 0 ? (
                    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-12 gap-0 bg-slate-50 p-2 text-[9px] font-bold text-slate-600 border-b border-slate-200">
                        <div className="col-span-2 text-center">التاريخ</div>
                        <div className="col-span-4 text-right">البيان</div>
                        <div className="col-span-2 text-center">مدين</div>
                        <div className="col-span-2 text-center">دائن</div>
                        <div className="col-span-2 text-center">الرصيد</div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {data.statement.map((s: StatementEntry, idx: number) => (
                          <div
                            key={s.id}
                            className={`grid grid-cols-12 gap-0 p-2 text-[11px] border-b border-slate-50 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            }`}
                          >
                            <div className="col-span-2 text-center text-slate-600">{formatDate(s.date)}</div>
                            <div className="col-span-4 text-right text-slate-800 truncate">
                              <div className="flex items-center gap-1">
                                {s.type === 'sale' && <ArrowDownToLine className="w-3 h-3 text-emerald-600 shrink-0" />}
                                {s.type === 'payment' && <ArrowUpFromLine className="w-3 h-3 text-blue-600 shrink-0" />}
                                {s.type === 'return' && <RotateCcw className="w-3 h-3 text-rose-600 shrink-0" />}
                                <span className="truncate">{s.description}</span>
                              </div>
                            </div>
                            <div className="col-span-2 text-center font-medium text-emerald-700">
                              {s.debit > 0 ? formatCurrency(s.debit) : '-'}
                            </div>
                            <div className="col-span-2 text-center font-medium text-blue-700">
                              {s.credit > 0 ? formatCurrency(s.credit) : '-'}
                            </div>
                            <div className={`col-span-2 text-center font-bold ${
                              s.balance > 0 ? 'text-amber-700' : s.balance < 0 ? 'text-emerald-700' : 'text-slate-600'
                            }`}>
                              {formatCurrency(s.balance)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-12 gap-0 p-2 bg-slate-100 text-[11px] font-bold border-t border-slate-200">
                        <div className="col-span-6 text-right text-slate-700">الإجمالي</div>
                        <div className="col-span-2 text-center text-emerald-800">
                          {formatCurrency(data.statement.reduce((s: number, e: StatementEntry) => s + e.debit, 0))}
                        </div>
                        <div className="col-span-2 text-center text-blue-800">
                          {formatCurrency(data.statement.reduce((s: number, e: StatementEntry) => s + e.credit, 0))}
                        </div>
                        <div className={`col-span-2 text-center ${data.summary.totalRemaining > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                          {formatCurrency(data.summary.totalRemaining)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">لا توجد عمليات في هذه الفترة</p>
                    </div>
                  )}
                </TabsContent>

                {/* الفواتير */}
                <TabsContent value="sales">
                  {data.sales?.length > 0 ? (
                    <div className="bg-white border border-slate-100 rounded-lg max-h-60 overflow-y-auto">
                      {data.sales.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between p-2 border-b border-slate-50 text-xs last:border-0">
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-slate-800">{formatDate(s.date)}</p>
                              {s.invoiceNo && (
                                <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                  {s.invoiceNo}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500">{s.items?.length || 0} صنف</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-emerald-700">{formatCurrency(s.total)}</p>
                            <p className="text-[10px] text-amber-600">متبقي: {formatCurrency(s.total - s.paid)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">لا توجد فواتير مبيعات في هذه الفترة</p>
                    </div>
                  )}
                </TabsContent>

                {/* السدادات */}
                <TabsContent value="payments">
                  {data.payments?.length > 0 ? (
                    <div className="bg-white border border-slate-100 rounded-lg max-h-60 overflow-y-auto">
                      {data.payments.map((p: Payment) => (
                        <div key={p.id} className="flex items-center justify-between p-2 border-b border-slate-50 text-xs last:border-0">
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-slate-800">{formatDate(p.date)}</p>
                              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                                {p.method === 'transfer' ? 'تحويل' : p.method === 'card' ? 'بطاقة' : 'كاش'}
                              </Badge>
                            </div>
                            {p.notes && <p className="text-[10px] text-slate-500 mt-0.5">{p.notes}</p>}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-blue-700">{formatCurrency(p.amount)}</p>
                            <p className="text-[10px] text-slate-500">سداد</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-2 bg-blue-50 text-xs font-bold">
                        <p className="text-blue-700">إجمالي السدادات ({data.payments.length})</p>
                        <p className="text-blue-900">{formatCurrency(data.summary.totalPaid)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">لا توجد سدادات في هذه الفترة</p>
                    </div>
                  )}
                </TabsContent>

                {/* المرتجعات */}
                <TabsContent value="returns">
                  {data.returns?.length > 0 ? (
                    <div className="bg-white border border-slate-100 rounded-lg max-h-60 overflow-y-auto">
                      {data.returns.map((r: SaleReturn) => (
                        <div key={r.id} className="flex items-center justify-between p-2 border-b border-slate-50 text-xs last:border-0">
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-slate-800">{formatDate(r.date)}</p>
                              <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-700 border-rose-200">
                                {r.returnNumber}
                              </Badge>
                            </div>
                            {r.reason && <p className="text-[10px] text-slate-500 mt-0.5">{r.reason}</p>}
                            <p className="text-[10px] text-slate-500">{r.items?.length || 0} صنف</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-rose-700">{formatCurrency(r.total)}</p>
                            <p className="text-[10px] text-slate-500">مسترد</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-2 bg-rose-50 text-xs font-bold">
                        <p className="text-rose-700">إجمالي المرتجعات ({data.returns.length})</p>
                        <p className="text-rose-900">{formatCurrency(data.summary.totalReturns)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">لا توجد مرتجعات في هذه الفترة</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

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
