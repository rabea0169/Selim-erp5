'use client'

import { useState } from 'react'
import {
  FileText,
  Download,
  Clock,
  AlertCircle,
  Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, todayStr, startOfMonth } from '@/lib/format'
import {
  workerRepository,
  workerAttendanceRepository,
  productionRepository,
  useLiveData,
} from '@/lib/db'
import {
  calculateAttendance,
  calculateWorkerHours,
  formatHours,
  formatMinutes,
} from '@/lib/attendance-calc'
import {
  getFactorySettings,
  buildFactoryHeader,
  buildFactoryFooter,
} from '@/lib/factory-header'
import type { Worker, WorkerAttendance } from '@/lib/db'
import type { WorkerBasic } from './workers/types'

interface WorkerReportModalProps {
  worker: WorkerBasic
  onClose: () => void
}

interface WorkerReportData {
  advances: any[]
  receipts: any[]
  productions: any[]
  attendance: WorkerAttendance[]
  fullWorker: Worker | null
  summary: {
    totalAdvances: number
    totalReceipts: number
    balance: number
    presentDays: number
    totalProduction: number
    totalPieces: number
    // ملخص الساعات والأجور
    totalWorkHours: number
    totalOvertimeHours: number
    totalLateMinutes: number
    totalRegularPay: number
    totalOvertimePay: number
    totalPay: number
  }
  // تفاصيل يومية لكل سجل حضور
  dailyDetails: Array<{
    date: string
    checkIn: string | null
    checkOut: string | null
    status: string
    workHours: number
    overtimeHours: number
    lateMinutes: number
    totalPay: number
  }>
}

export function WorkerReportModal({ worker, onClose }: WorkerReportModalProps) {
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  // جلب بيانات تقرير الموظف مع التحديث الفوري
  const { data, loading, reload } = useLiveData<WorkerReportData | null>(
    async () => {
      const [stats, attendance, productions, fullWorker] = await Promise.all([
        workerRepository.getWithStats(worker.id),
        workerAttendanceRepository.getByDateRange(from || undefined, to || undefined, worker.id),
        productionRepository.getByDateRange(from || undefined, to || undefined, worker.id),
        workerRepository.getById(worker.id),
      ])

      if (!stats) return null

      // فلترة السلف والقبض حسب النطاق الزمني
      const fromTime = from ? new Date(from).getTime() : 0
      const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Date.now()
      const inRange = (d: string) => {
        const t = new Date(d).getTime()
        return t >= fromTime && t <= toTime
      }
      const advances = stats.advances.filter((a) => inRange(a.date))
      const receipts = stats.receipts.filter((r) => inRange(r.date))

      const totalAdvances = advances.reduce((s, a) => s + a.amount, 0)
      const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0)
      const totalProduction = productions.reduce((s, p) => s + p.total, 0)
      const totalPieces = productions.reduce((s, p) => s + p.quantity, 0)

      // حساب إجمالي الساعات والأجور باستخدام calculateWorkerHours
      const workerForCalc: Worker = fullWorker || ({
        id: worker.id,
        name: worker.name,
        type: worker.type as any,
        job: worker.job ?? undefined,
        notes: worker.notes ?? undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Worker)

      const hoursCalc = calculateWorkerHours(attendance, workerForCalc)

      // تفاصيل يومية لكل سجل حضور (مرتبة تصاعدياً حسب التاريخ)
      const dailyDetails = attendance
        .filter((a) => a.status === 'present')
        .map((a) => {
          const calc = calculateAttendance(a, workerForCalc)
          return {
            date: a.date,
            checkIn: a.checkIn ?? null,
            checkOut: a.checkOut ?? null,
            status: a.status,
            workHours: calc.workHours,
            overtimeHours: calc.overtimeHours,
            lateMinutes: calc.lateMinutes,
            totalPay: calc.totalPay,
          }
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      return {
        advances,
        receipts,
        productions,
        attendance,
        fullWorker: fullWorker ?? null,
        summary: {
          totalAdvances,
          totalReceipts,
          balance: totalAdvances - totalReceipts,
          presentDays: hoursCalc.presentDays,
          totalProduction,
          totalPieces,
          totalWorkHours: hoursCalc.totalWorkHours,
          totalOvertimeHours: hoursCalc.totalOvertimeHours,
          totalLateMinutes: hoursCalc.totalLateMinutes,
          totalRegularPay: hoursCalc.totalRegularPay,
          totalOvertimePay: hoursCalc.totalOvertimePay,
          totalPay: hoursCalc.totalPay,
        },
        dailyDetails,
      }
    },
    ['workerAdvances', 'workerReceipts', 'workerAttendance', 'production']
  )

  const exportPDF = async () => {
    if (!data) return
    setExporting(true)
    try {
      const { exportElementToPDF, shareViaWhatsApp, createReportContainer, cleanupContainer } =
        await import('@/lib/pdf-export')

      const settings = await getFactorySettings()
      const header = buildFactoryHeader(settings)
      const footer = buildFactoryFooter(settings)

      const advanceRows = (data.advances || [])
        .map(
          (a: any) =>
            `<tr><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${formatDate(a.date)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:bold;">${formatCurrency(a.amount)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;font-size:11px;">${a.notes || '-'}</td></tr>`
        )
        .join('')

      const receiptRows = (data.receipts || [])
        .map(
          (r: any) =>
            `<tr><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${formatDate(r.date)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;color:#059669;font-weight:bold;">${formatCurrency(r.amount)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;font-size:11px;">${r.notes || '-'}</td></tr>`
        )
        .join('')

      const productionRows = (data.productions || [])
        .map(
          (p: any) =>
            `<tr><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${formatDate(p.date)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${p.modelName}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${p.quantity}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${formatCurrency(p.unitPrice)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;color:#059669;font-weight:bold;">${formatCurrency(p.total)}</td></tr>`
        )
        .join('')

      // صفوف تفاصيل الساعات اليومية
      const dailyRows = (data.dailyDetails || [])
        .map(
          (d) =>
            `<tr><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${formatDate(d.date)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${d.checkIn ? new Date(d.checkIn).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;">${d.checkOut ? new Date(d.checkOut).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;">${formatHours(d.workHours)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;color:#d97706;font-weight:bold;">${d.overtimeHours > 0 ? formatHours(d.overtimeHours) : '-'}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;color:${d.lateMinutes > 0 ? '#dc2626' : '#64748b'};font-weight:bold;">${formatMinutes(d.lateMinutes)}</td><td style="padding:5px;border:1px solid #e2e8f0;text-align:center;color:#059669;font-weight:bold;">${formatCurrency(d.totalPay)}</td></tr>`
        )
        .join('')

      const typeLabel =
        worker.type === 'production'
          ? 'إنتاج بالقطعة'
          : worker.type === 'hourly'
          ? 'بالساعة'
          : 'مرتب شهري'

      // بطاقات ملخص الساعات والأجور
      const hoursCardsHtml = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px;">
          <div style="padding: 10px; background: #f0f9ff; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #1e40af;">إجمالي ساعات العمل</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #1e3a8a;">${formatHours(data.summary.totalWorkHours)}</p>
          </div>
          <div style="padding: 10px; background: #fffbeb; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #92400e;">ساعات إضافية</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #78350f;">${formatHours(data.summary.totalOvertimeHours)}</p>
          </div>
          <div style="padding: 10px; background: #fef2f2; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #991b1b;">دقائق التأخير</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #7f1d1d;">${formatMinutes(data.summary.totalLateMinutes)}</p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px;">
          <div style="padding: 10px; background: #ecfdf5; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #047857;">أجر الساعات العادية</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #065f46;">${formatCurrency(data.summary.totalRegularPay)}</p>
          </div>
          <div style="padding: 10px; background: #f0fdf4; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #166534;">أجر الساعات الإضافية</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #14532d;">${formatCurrency(data.summary.totalOvertimePay)}</p>
          </div>
          <div style="padding: 10px; background: #eef2ff; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #4338ca;">الإجمالي المستحق</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #312e81;">${formatCurrency(data.summary.totalPay)}</p>
          </div>
        </div>`

      const contentHtml = `
        ${header}
        <div style="margin-bottom: 20px; padding: 16px; background: #faf5ff; border-radius: 8px;">
          <h2 style="margin: 0 0 8px; color: #1e293b;">بيانات الموظف</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
            <p><strong>الاسم:</strong> ${worker.name}</p>
            <p><strong>الوظيفة:</strong> ${worker.job || '-'}</p>
            <p><strong>الهاتف:</strong> ${worker.phone || '-'}</p>
            <p><strong>النوع:</strong> ${typeLabel}</p>
            <p><strong>الفترة:</strong> ${formatDate(from)} إلى ${formatDate(to)}</p>
            ${data.fullWorker?.hourlyRate ? `<p><strong>سعر الساعة:</strong> ${formatCurrency(data.fullWorker.hourlyRate)}</p>` : ''}
            ${data.fullWorker?.monthlySalary ? `<p><strong>المرتب الشهري:</strong> ${formatCurrency(data.fullWorker.monthlySalary)}</p>` : ''}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="padding: 12px; background: #fef2f2; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #991b1b;">إجمالي السلف</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #7f1d1d;">${formatCurrency(data.summary.totalAdvances)}</p>
          </div>
          <div style="padding: 12px; background: #f0fdf4; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #166534;">إجمالي القبض</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #14532d;">${formatCurrency(data.summary.totalReceipts)}</p>
          </div>
          <div style="padding: 12px; background: #fffbeb; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #92400e;">الرصيد (مستحق للموظف/له)</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #78350f;">${formatCurrency(data.summary.balance)}</p>
          </div>
          <div style="padding: 12px; background: #eff6ff; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #1e40af;">أيام الحضور</p>
            <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold; color: #1e3a8a;">${data.summary.presentDays}</p>
          </div>
        </div>
        ${hoursCardsHtml}
        ${data.summary.totalProduction > 0 ? `
        <div style="padding: 12px; background: #eef2ff; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between;">
          <div>
            <p style="margin: 0; font-size: 11px; color: #4338ca;">إجمالي الإنتاج</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #312e81;">${data.summary.totalPieces} قطعة</p>
          </div>
          <div style="text-align: left;">
            <p style="margin: 0; font-size: 11px; color: #4338ca;">المستحق للإنتاج</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #312e81;">${formatCurrency(data.summary.totalProduction)}</p>
          </div>
        </div>` : ''}
        ${(data.dailyDetails || []).length > 0 ? `
        <h3 style="color: #1e293b; margin: 16px 0 8px;">تفاصيل الساعات اليومية</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead><tr style="background: #f0f9ff;"><th style="padding:5px;border:1px solid #e2e8f0;">التاريخ</th><th style="padding:5px;border:1px solid #e2e8f0;">الحضور</th><th style="padding:5px;border:1px solid #e2e8f0;">الانصراف</th><th style="padding:5px;border:1px solid #e2e8f0;">الساعات</th><th style="padding:5px;border:1px solid #e2e8f0;">إضافي</th><th style="padding:5px;border:1px solid #e2e8f0;">التأخير</th><th style="padding:5px;border:1px solid #e2e8f0;">الأجر</th></tr></thead>
          <tbody>${dailyRows}</tbody>
        </table>` : ''}
        ${data.advances?.length > 0 ? `
        <h3 style="color: #1e293b; margin: 16px 0 8px;">السلف</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead><tr style="background: #fef2f2;"><th style="padding:5px;border:1px solid #e2e8f0;">التاريخ</th><th style="padding:5px;border:1px solid #e2e8f0;">المبلغ</th><th style="padding:5px;border:1px solid #e2e8f0;">ملاحظات</th></tr></thead>
          <tbody>${advanceRows}</tbody>
        </table>` : ''}
        ${data.receipts?.length > 0 ? `
        <h3 style="color: #1e293b; margin: 16px 0 8px;">القبض</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead><tr style="background: #f0fdf4;"><th style="padding:5px;border:1px solid #e2e8f0;">التاريخ</th><th style="padding:5px;border:1px solid #e2e8f0;">المبلغ</th><th style="padding:5px;border:1px solid #e2e8f0;">ملاحظات</th></tr></thead>
          <tbody>${receiptRows}</tbody>
        </table>` : ''}
        ${data.productions?.length > 0 ? `
        <h3 style="color: #1e293b; margin: 16px 0 8px;">الإنتاج بالقطعة</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead><tr style="background: #eef2ff;"><th style="padding:5px;border:1px solid #e2e8f0;">التاريخ</th><th style="padding:5px;border:1px solid #e2e8f0;">الموديل</th><th style="padding:5px;border:1px solid #e2e8f0;">الكمية</th><th style="padding:5px;border:1px solid #e2e8f0;">سعر القطعة</th><th style="padding:5px;border:1px solid #e2e8f0;">الإجمالي</th></tr></thead>
          <tbody>${productionRows}</tbody>
        </table>` : ''}
        ${footer}
      `

      const container = createReportContainer(`تقرير الموظف: ${worker.name}`, contentHtml)
      await new Promise((r) => setTimeout(r, 100))
      const file = await exportElementToPDF(container, `تقرير-الموظف-${worker.name}.pdf`)
      cleanupContainer(container)

      toast({ title: 'تم', description: 'تم إنشاء PDF - جارٍ المشاركة عبر الواتساب' })
      await shareViaWhatsApp(file, `تقرير الموظف: ${worker.name}\nالفترة: ${formatDate(from)} إلى ${formatDate(to)}\nإجمالي المستحق: ${formatCurrency(data.summary.totalPay)}`)
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
            <FileText className="w-5 h-5 text-purple-600" />
            تقرير الموظف: {worker.name}
          </DialogTitle>
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
          <Button onClick={reload} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white" size="sm">
            {loading ? 'جارٍ التحميل...' : 'عرض التقرير'}
          </Button>

          {data && (
            <>
              {/* ملخص السلف والقبض والرصيد والحضور */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-rose-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-rose-700">إجمالي السلف</p>
                  <p className="font-bold text-rose-900">{formatCurrency(data.summary.totalAdvances)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-emerald-700">إجمالي القبض</p>
                  <p className="font-bold text-emerald-900">{formatCurrency(data.summary.totalReceipts)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-amber-700">الرصيد</p>
                  <p className="font-bold text-amber-900">{formatCurrency(data.summary.balance)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-blue-700">أيام الحضور</p>
                  <p className="font-bold text-blue-900">{data.summary.presentDays}</p>
                </div>
              </div>

              {/* ملخص الساعات */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  ملخص الساعات
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-blue-700">إجمالي ساعات العمل</p>
                    <p className="font-bold text-blue-900 text-[11px]">
                      {formatHours(data.summary.totalWorkHours)}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-amber-700">ساعات إضافية</p>
                    <p className="font-bold text-amber-900 text-[11px]">
                      {formatHours(data.summary.totalOvertimeHours)}
                    </p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-rose-700 flex items-center justify-center gap-0.5">
                      <AlertCircle className="w-2.5 h-2.5" />
                      دقائق التأخير
                    </p>
                    <p className="font-bold text-rose-900 text-[11px]">
                      {formatMinutes(data.summary.totalLateMinutes)}
                    </p>
                  </div>
                </div>
              </div>

              {/* ملخص الأجور */}
              {data.summary.totalPay > 0 && (
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" />
                    ملخص الأجور
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <p className="text-[9px] text-emerald-700">أجر الساعات العادية</p>
                      <p className="font-bold text-emerald-900 text-[11px]">
                        {formatCurrency(data.summary.totalRegularPay)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <p className="text-[9px] text-green-700">أجر الساعات الإضافية</p>
                      <p className="font-bold text-green-900 text-[11px]">
                        {formatCurrency(data.summary.totalOvertimePay)}
                      </p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-2 text-center border border-indigo-200">
                      <p className="text-[9px] text-indigo-700">الإجمالي المستحق</p>
                      <p className="font-bold text-indigo-900 text-[11px]">
                        {formatCurrency(data.summary.totalPay)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ملخص الإنتاج */}
              {data.summary.totalProduction > 0 && (
                <div className="bg-indigo-50 rounded-lg p-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-indigo-700">إجمالي القطع</p>
                    <p className="font-bold text-indigo-900">{data.summary.totalPieces} قطعة</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-700">المستحق للإنتاج</p>
                    <p className="font-bold text-indigo-900">{formatCurrency(data.summary.totalProduction)}</p>
                  </div>
                </div>
              )}

              {/* جدول تفصيلي لكل يوم */}
              {data.dailyDetails.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      تفاصيل الساعات اليومية ({data.dailyDetails.length} يوم)
                    </p>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-[10px]">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-slate-200">
                          <th className="px-2 py-1.5 text-right font-bold text-slate-600">التاريخ</th>
                          <th className="px-2 py-1.5 text-center font-bold text-slate-600">حضور</th>
                          <th className="px-2 py-1.5 text-center font-bold text-slate-600">انصراف</th>
                          <th className="px-2 py-1.5 text-center font-bold text-slate-600">ساعات</th>
                          <th className="px-2 py-1.5 text-center font-bold text-slate-600">إضافي</th>
                          <th className="px-2 py-1.5 text-center font-bold text-slate-600">تأخير</th>
                          <th className="px-2 py-1.5 text-center font-bold text-slate-600">الأجر</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.dailyDetails.map((d, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-2 py-1.5 text-right text-slate-700">
                              {formatDate(d.date)}
                            </td>
                            <td className="px-2 py-1.5 text-center text-emerald-700 font-medium">
                              {d.checkIn
                                ? new Date(d.checkIn).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </td>
                            <td className="px-2 py-1.5 text-center text-blue-700 font-medium">
                              {d.checkOut
                                ? new Date(d.checkOut).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold text-slate-800">
                              {formatHours(d.workHours)}
                            </td>
                            <td className={`px-2 py-1.5 text-center font-medium ${d.overtimeHours > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                              {d.overtimeHours > 0 ? formatHours(d.overtimeHours) : '-'}
                            </td>
                            <td className={`px-2 py-1.5 text-center font-medium ${d.lateMinutes > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                              {formatMinutes(d.lateMinutes)}
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold text-emerald-700">
                              {formatCurrency(d.totalPay)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button
                onClick={exportPDF}
                disabled={exporting}
                className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
              >
                <Download className="w-4 h-4 ml-1" />
                {exporting ? 'جارٍ التصدير...' : 'تصدير PDF ومشاركة واتساب'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
