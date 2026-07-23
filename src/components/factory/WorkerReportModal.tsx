'use client'

import { useState } from 'react'
import {
  FileText,
  Download,
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
  getFactorySettings,
  buildFactoryHeader,
  buildFactoryFooter,
} from '@/lib/factory-header'
import type { WorkerBasic } from './workers/types'

interface WorkerReportModalProps {
  worker: WorkerBasic
  onClose: () => void
}

interface WorkerReportData {
  advances: any[]
  receipts: any[]
  productions: any[]
  attendance: any[]
  summary: {
    totalAdvances: number
    totalReceipts: number
    balance: number
    presentDays: number
    totalProduction: number
    totalPieces: number
  }
}

export function WorkerReportModal({ worker, onClose }: WorkerReportModalProps) {
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  // جلب بيانات تقرير العامل مع التحديث الفوري
  const { data, loading, reload } = useLiveData<WorkerReportData | null>(
    async () => {
      const [stats, attendance, productions] = await Promise.all([
        workerRepository.getWithStats(worker.id),
        workerAttendanceRepository.getByDateRange(from || undefined, to || undefined, worker.id),
        productionRepository.getByDateRange(from || undefined, to || undefined, worker.id),
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
      const presentDays = attendance.filter((a) => a.status === 'present').length

      return {
        advances,
        receipts,
        productions,
        attendance,
        summary: {
          totalAdvances,
          totalReceipts,
          balance: totalAdvances - totalReceipts,
          presentDays,
          totalProduction,
          totalPieces,
        },
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

      const contentHtml = `
        ${header}
        <div style="margin-bottom: 20px; padding: 16px; background: #faf5ff; border-radius: 8px;">
          <h2 style="margin: 0 0 8px; color: #1e293b;">بيانات العامل</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
            <p><strong>الاسم:</strong> ${worker.name}</p>
            <p><strong>الوظيفة:</strong> ${worker.job || '-'}</p>
            <p><strong>الهاتف:</strong> ${worker.phone || '-'}</p>
            <p><strong>النوع:</strong> ${worker.type === 'production' ? 'إنتاج بالقطعة' : 'مرتب شهري'}</p>
            <p><strong>الفترة:</strong> ${formatDate(from)} إلى ${formatDate(to)}</p>
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
            <p style="margin: 0; font-size: 11px; color: #92400e;">الرصيد (مستحق للعامل/له)</p>
            <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #78350f;">${formatCurrency(data.summary.balance)}</p>
          </div>
          <div style="padding: 12px; background: #eff6ff; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #1e40af;">أيام الحضور</p>
            <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold; color: #1e3a8a;">${data.summary.presentDays}</p>
          </div>
        </div>
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

      const container = createReportContainer(`تقرير العامل: ${worker.name}`, contentHtml)
      await new Promise((r) => setTimeout(r, 100))
      const file = await exportElementToPDF(container, `تقرير-العامل-${worker.name}.pdf`)
      cleanupContainer(container)

      toast({ title: 'تم', description: 'تم إنشاء PDF - جارٍ المشاركة عبر الواتساب' })
      await shareViaWhatsApp(file, `تقرير العامل: ${worker.name}\nالفترة: ${formatDate(from)} إلى ${formatDate(to)}`)
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
            تقرير العامل: {worker.name}
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
