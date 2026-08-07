'use client'

import { useState, useEffect } from 'react'
import { FileText, TrendingUp, CreditCard, RotateCcw, ArrowDownToLine, ArrowUpFromLine, Wallet } from 'lucide-react'
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
  supplierRepository,
  paymentRepository,
  purchaseReturnRepository,
  useLiveData,
  type Payment,
  type PurchaseReturn,
} from '@/lib/db'
import {
  getFactorySettings,
  buildFactoryHeader,
  buildFactoryFooter,
} from '@/lib/factory-header'
import { PrintButton } from '../PrintButton'
import type { SupplierWithStats } from './SupplierCard'

interface SupplierReportProps {
  supplier: SupplierWithStats
  onClose: () => void
}

interface StatementEntry {
  id: string
  date: string
  description: string
  type: 'purchase' | 'payment' | 'return'
  debit: number
  credit: number
  balance: number
}

export function SupplierReport({ supplier, onClose }: SupplierReportProps) {
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [exporting, setExporting] = useState(false)
  const [printHtml, setPrintHtml] = useState('')
  const { toast } = useToast()

  const { data, loading, reload } = useLiveData<any>(async () => {
    const [stats, payments, allReturns] = await Promise.all([
      supplierRepository.getWithStats(supplier.id),
      paymentRepository.getByParty(supplier.id),
      purchaseReturnRepository.getByDateRange(),
    ])

    if (!stats) return null

    const supplierPayments = payments
      .filter((p) => p.type === 'supplier_payment')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const supplierReturns = allReturns
      .filter((r) => r.supplierId_ref === supplier.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const fromTime = from ? new Date(from).getTime() : 0
    const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Date.now()

    const filteredPurchases = stats.purchases.filter((p) => {
      const t = new Date(p.date).getTime()
      return t >= fromTime && t <= toTime
    })
    const filteredPayments = supplierPayments.filter((p) => {
      const t = new Date(p.date).getTime()
      return t >= fromTime && t <= toTime
    })
    const filteredReturns = supplierReturns.filter((r) => {
      const t = new Date(r.date).getTime()
      return t >= fromTime && t <= toTime
    })

    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + p.total, 0)
    const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
    const totalReturns = filteredReturns.reduce((sum, r) => sum + r.total, 0)
    const totalRemaining = totalPurchases - totalPaid - totalReturns

    // بناء كشف الحساب
    const statementEntries: StatementEntry[] = []
    let runningBalance = 0

    // جميع العمليات في مصفوفة واحدة مرتبة بالتاريخ
    type AnyEntry =
      | { kind: 'purchase'; date: string; id: string; total: number; invoiceNo?: string }
      | { kind: 'payment'; date: string; id: string; amount: number; method?: string }
      | { kind: 'return'; date: string; id: string; total: number; returnNumber: string }

    const allEntries: AnyEntry[] = [
      ...filteredPurchases.map((p) => ({ kind: 'purchase' as const, date: p.date, id: p.id, total: p.total, invoiceNo: p.invoiceNo })),
      ...filteredPayments.map((p) => ({ kind: 'payment' as const, date: p.date, id: p.id, amount: p.amount, method: p.method })),
      ...filteredReturns.map((r) => ({ kind: 'return' as const, date: r.date, id: r.id, total: r.total, returnNumber: r.returnNumber })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    for (const entry of allEntries) {
      let debit = 0
      let credit = 0
      let description = ''
      let type: StatementEntry['type'] = 'purchase'

      if (entry.kind === 'purchase') {
        debit = entry.total
        description = `فاتورة مشتريات ${entry.invoiceNo ? `(${entry.invoiceNo})` : ''}`
        type = 'purchase'
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
      purchases: filteredPurchases,
      payments: filteredPayments,
      returns: filteredReturns,
      statement: statementEntries,
      totalPurchases,
      totalPaid,
      totalReturns,
      totalRemaining,
      purchasesCount: filteredPurchases.length,
      paymentsCount: filteredPayments.length,
      returnsCount: filteredReturns.length,
      summary: {
        purchasesCount: filteredPurchases.length,
        paymentsCount: filteredPayments.length,
        returnsCount: filteredReturns.length,
        totalPurchases,
        totalPaid,
        totalReturns,
        totalRemaining,
      },
    }
  }, ['purchases', 'payments', 'purchaseReturns'])

  // بناء HTML التقرير الكامل (ترويسة المصنع + كشف الحساب + الفواتير + التذييل)
  // يُستخدم لتصدير PDF وللطباعة المباشرة
  const buildReportHtml = async (): Promise<string> => {
    const settings = await getFactorySettings()
    const header = buildFactoryHeader(settings)
    const footer = buildFactoryFooter(settings)

    const purchaseRows = (data.purchases || [])
      .map(
        (p: any) => `
        <tr>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${formatDate(p.date)}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${p.invoiceNo || '-'}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${p.items?.length || 0}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center; color: #d97706; font-weight: bold;">${formatCurrency(p.total)}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${formatCurrency(p.paid)}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center; color: #b91c1c; font-weight: bold;">${formatCurrency(p.total - p.paid)}</td>
        </tr>`
      )
      .join('')

    const statementRows = (data.statement || [])
      .map(
        (s: StatementEntry) => `
        <tr>
          <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">${formatDate(s.date)}</td>
          <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: right; font-size: 11px;">${s.description}</td>
          <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: ${s.debit > 0 ? '#d97706' : '#94a3b8'}; font-weight: ${s.debit > 0 ? 'bold' : 'normal'};">${s.debit > 0 ? formatCurrency(s.debit) : '-'}</td>
          <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: ${s.credit > 0 ? '#059669' : '#94a3b8'}; font-weight: ${s.credit > 0 ? 'bold' : 'normal'};">${s.credit > 0 ? formatCurrency(s.credit) : '-'}</td>
          <td style="padding: 5px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px; font-weight: bold;">${formatCurrency(s.balance)}</td>
        </tr>`
      )
      .join('')

    return `
      ${header}
      <div style="margin-bottom: 20px; padding: 16px; background: #fffbeb; border-radius: 8px;">
        <h2 style="margin: 0 0 8px; color: #1e293b;">بيانات المورد</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
          <p><strong>الاسم:</strong> ${supplier.name}</p>
          <p><strong>الهاتف:</strong> ${supplier.phone || '-'}</p>
          <p><strong>العنوان:</strong> ${supplier.address || '-'}</p>
          <p><strong>الفترة:</strong> ${formatDate(from)} إلى ${formatDate(to)}</p>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="padding: 12px; background: #fffbeb; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #92400e;">عدد الفواتير</p>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold; color: #78350f;">${data.summary.purchasesCount}</p>
        </div>
        <div style="padding: 12px; background: #fef3c7; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #92400e;">إجمالي المشتريات</p>
          <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #78350f;">${formatCurrency(data.summary.totalPurchases)}</p>
        </div>
        <div style="padding: 12px; background: #dbeafe; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #1e40af;">المدفوع</p>
          <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #1e3a8a;">${formatCurrency(data.summary.totalPaid)}</p>
        </div>
        <div style="padding: 12px; background: #fee2e2; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #b91c1c;">المتبقي للمورد</p>
          <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #7f1d1d;">${formatCurrency(data.summary.totalRemaining)}</p>
        </div>
      </div>
      <h3 style="color: #1e293b; margin: 16px 0 8px;">كشف حساب المورد</h3>
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
          ${purchaseRows || '<tr><td colspan="6" style="padding: 12px; text-align: center; color: #94a3b8;">لا توجد فواتير في هذه الفترة</td></tr>'}
        </tbody>
      </table>
      ${footer}
    `
  }

  // تحضير HTML الطباعة عند تغير البيانات (لزر الطباعة المباشرة)
  useEffect(() => {
    let cancelled = false
    if (!data) {
      setPrintHtml('')
      return
    }
    buildReportHtml()
      .then((h) => {
        if (!cancelled) setPrintHtml(h)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, from, to])

  const exportPDF = async () => {
    if (!data) return
    setExporting(true)
    try {
      const { exportElementToPDF, shareViaWhatsApp, createReportContainer, cleanupContainer } =
        await import('@/lib/pdf-export')

      const contentHtml = await buildReportHtml()

      const container = createReportContainer(`تقرير المورد: ${supplier.name}`, contentHtml)
      await new Promise((r) => setTimeout(r, 100))
      const file = await exportElementToPDF(container, `تقرير-المورد-${supplier.name}.pdf`)
      cleanupContainer(container)

      toast({ title: 'تم', description: 'تم إنشاء PDF - جارٍ المشاركة عبر الواتساب' })
      await shareViaWhatsApp(file, `تقرير المورد: ${supplier.name}\nالفترة: ${formatDate(from)} إلى ${formatDate(to)}\nالمتبقي: ${formatCurrency(data.summary.totalRemaining)}`)
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
            <FileText className="w-5 h-5 text-amber-600" />
            تقرير المورد: {supplier.name}
          </DialogTitle>
          <DialogDescription className="sr-only">تقرير شامل للمورد يشمل كشف الحساب والمدفوعات</DialogDescription>
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
          <Button onClick={reload} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white" size="sm">
            {loading ? 'جارٍ التحميل...' : 'عرض التقرير'}
          </Button>

          {data && (
            <>
              {/* بطاقات الملخص */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-amber-700">عدد الفواتير</p>
                  <p className="font-bold text-amber-900">{data.summary.purchasesCount}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-amber-700">إجمالي المشتريات</p>
                  <p className="font-bold text-amber-900">{formatCurrency(data.summary.totalPurchases)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-blue-700">المدفوع</p>
                  <p className="font-bold text-blue-900">{formatCurrency(data.summary.totalPaid)}</p>
                </div>
                <div className="bg-rose-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-rose-700">المتبقي للمورد</p>
                  <p className="font-bold text-rose-900">{formatCurrency(data.summary.totalRemaining)}</p>
                </div>
              </div>

              {(data.summary.totalReturns || 0) > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-emerald-700">إجمالي المرتجعات</p>
                    <p className="font-bold text-emerald-900">{formatCurrency(data.summary.totalReturns)}</p>
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
                  <TabsTrigger value="purchases" className="text-[10px]">
                    <ArrowDownToLine className="w-3 h-3 ml-0.5" />
                    الفواتير
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="text-[10px]">
                    <CreditCard className="w-3 h-3 ml-0.5" />
                    المدفوعات
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
                      {/* رأس الجدول */}
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
                                {s.type === 'purchase' && <ArrowDownToLine className="w-3 h-3 text-amber-600 shrink-0" />}
                                {s.type === 'payment' && <ArrowUpFromLine className="w-3 h-3 text-emerald-600 shrink-0" />}
                                {s.type === 'return' && <RotateCcw className="w-3 h-3 text-blue-600 shrink-0" />}
                                <span className="truncate">{s.description}</span>
                              </div>
                            </div>
                            <div className="col-span-2 text-center font-medium text-amber-700">
                              {s.debit > 0 ? formatCurrency(s.debit) : '-'}
                            </div>
                            <div className="col-span-2 text-center font-medium text-emerald-700">
                              {s.credit > 0 ? formatCurrency(s.credit) : '-'}
                            </div>
                            <div className={`col-span-2 text-center font-bold ${
                              s.balance > 0 ? 'text-rose-700' : s.balance < 0 ? 'text-emerald-700' : 'text-slate-600'
                            }`}>
                              {formatCurrency(s.balance)}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* إجمالي كشف الحساب */}
                      <div className="grid grid-cols-12 gap-0 p-2 bg-slate-100 text-[11px] font-bold border-t border-slate-200">
                        <div className="col-span-6 text-right text-slate-700">الإجمالي</div>
                        <div className="col-span-2 text-center text-amber-800">
                          {formatCurrency(data.statement.reduce((s: number, e: StatementEntry) => s + e.debit, 0))}
                        </div>
                        <div className="col-span-2 text-center text-emerald-800">
                          {formatCurrency(data.statement.reduce((s: number, e: StatementEntry) => s + e.credit, 0))}
                        </div>
                        <div className={`col-span-2 text-center ${data.summary.totalRemaining > 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
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
                <TabsContent value="purchases">
                  {data.purchases?.length > 0 ? (
                    <div className="bg-white border border-slate-100 rounded-lg max-h-60 overflow-y-auto">
                      {data.purchases.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2 border-b border-slate-50 text-xs last:border-0">
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-slate-800">{formatDate(p.date)}</p>
                              {p.invoiceNo && (
                                <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                                  {p.invoiceNo}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500">{p.items?.length || 0} صنف</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-amber-700">{formatCurrency(p.total)}</p>
                            <p className="text-[10px] text-rose-600">متبقي: {formatCurrency(p.total - p.paid)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <ArrowDownToLine className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">لا توجد فواتير مشتريات في هذه الفترة</p>
                    </div>
                  )}
                </TabsContent>

                {/* المدفوعات */}
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
                            <p className="font-bold text-emerald-700">{formatCurrency(p.amount)}</p>
                            <p className="text-[10px] text-slate-500">سداد</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-2 bg-blue-50 text-xs font-bold">
                        <p className="text-blue-700">إجمالي المدفوعات ({data.payments.length})</p>
                        <p className="text-blue-900">{formatCurrency(data.summary.totalPaid)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">لا توجد مدفوعات في هذه الفترة</p>
                    </div>
                  )}
                </TabsContent>

                {/* المرتجعات */}
                <TabsContent value="returns">
                  {data.returns?.length > 0 ? (
                    <div className="bg-white border border-slate-100 rounded-lg max-h-60 overflow-y-auto">
                      {data.returns.map((r: PurchaseReturn) => (
                        <div key={r.id} className="flex items-center justify-between p-2 border-b border-slate-50 text-xs last:border-0">
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-slate-800">{formatDate(r.date)}</p>
                              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                                {r.returnNumber}
                              </Badge>
                            </div>
                            {r.reason && <p className="text-[10px] text-slate-500 mt-0.5">{r.reason}</p>}
                            <p className="text-[10px] text-slate-500">{r.items?.length || 0} صنف</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-blue-700">{formatCurrency(r.total)}</p>
                            <p className="text-[10px] text-slate-500">مسترد</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-2 bg-emerald-50 text-xs font-bold">
                        <p className="text-emerald-700">إجمالي المرتجعات ({data.returns.length})</p>
                        <p className="text-emerald-900">{formatCurrency(data.summary.totalReturns)}</p>
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

              <div className="flex gap-2">
                <Button
                  onClick={exportPDF}
                  disabled={exporting}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                >
                  <TrendingUp className="w-4 h-4 ml-1" />
                  {exporting ? 'جارٍ التصدير...' : 'تصدير PDF وواتساب'}
                </Button>
                {printHtml && (
                  <PrintButton
                    contentHtml={printHtml}
                    title={`كشف حساب المورد: ${supplier.name}`}
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50"
                    label="طباعة"
                  />
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
