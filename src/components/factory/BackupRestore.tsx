'use client'

import { useState, useRef } from 'react'
import {
  Download,
  Upload,
  AlertTriangle,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { reportRepository, dataChangeEmitter } from '@/lib/db'

// حد أقصى لحجم ملف النسخة المقبول (30 ميجابايت)
const MAX_BACKUP_FILE_SIZE = 30 * 1024 * 1024

// ترجمة عربية لمفاتيح العدادات الراجعة من السيرفر
const COUNT_LABELS: Record<string, string> = {
  workers: 'العمال',
  workerAdvances: 'سلف العمال',
  workerReceipts: 'قبضيات العمال',
  workerAttendance: 'الحضور',
  production: 'الإنتاج',
  customers: 'العملاء',
  suppliers: 'الموردون',
  sales: 'فواتير المبيعات',
  saleItems: 'عناصر المبيعات',
  purchases: 'فواتير المشتريات',
  purchaseItems: 'عناصر المشتريات',
  expenses: 'المصاريف',
  expenseCategories: 'فئات المصاريف',
  products: 'المنتجات',
  materials: 'المواد الخام',
  warehouses: 'المخازن',
  materialTransactions: 'حركات المواد',
  productionOrders: 'أوامر التشغيل',
  payments: 'السدادات',
  saleReturns: 'مرتجعات المبيعات',
  purchaseReturns: 'مرتجعات المشتريات',
  treasuryTransactions: 'حركات الخزينة',
  factorySettings: 'إعدادات المصنع',
  auditLogs: 'سجل التدقيق',
}

export function BackupRestore({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleBackup = async () => {
    setExporting(true)
    try {
      const data = await reportRepository.exportAll()
      // تنزيل الملف — اسم الملف يتضمن التاريخ والوقت
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
      a.href = url
      a.download = `selim-erp-backup-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      const warnings: string[] = Array.isArray(data?.warnings) ? data.warnings : []
      if (warnings.length > 0) {
        // بعض الكيانات تعذّر تصديرها — نُعلم المستخدم مع استمرار التنزيل
        const names = warnings.map((w) => COUNT_LABELS[w] || w).join('، ')
        toast({
          title: 'تم إنشاء النسخة مع تحذيرات',
          description: `تعذّر تصدير: ${names}`,
        })
      } else {
        toast({ title: 'تم تنزيل النسخة الاحتياطية' })
      }
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // حد الحجم قبل القراءة
    if (file.size > MAX_BACKUP_FILE_SIZE) {
      toast({
        title: 'خطأ',
        description: 'حجم ملف النسخة أكبر من الحد المسموح (30 ميجابايت)',
        variant: 'destructive',
      })
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        // تحقق أولي من البنية قبل عرض تأكيد الاسترجاع
        if (!data || typeof data !== 'object' || !data.data || typeof data.data !== 'object') {
          toast({ title: 'خطأ', description: 'ملف النسخة الاحتياطية غير صالح — بنية البيانات غير صحيحة', variant: 'destructive' })
          return
        }
        setConfirmRestore(data)
      } catch {
        toast({ title: 'خطأ', description: 'تعذرت قراءة الملف — تأكد أنه ملف نسخة احتياطية JSON صالح', variant: 'destructive' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleRestore = async () => {
    if (!confirmRestore) return
    setImporting(true)
    try {
      const result = await reportRepository.importAll(confirmRestore)
      const allTypes = [
        'sales', 'purchases', 'workers', 'workerAdvances', 'workerReceipts',
        'workerAttendance', 'production', 'customers', 'suppliers', 'expenses',
        'expenseCategories', 'factorySettings', 'treasuryTransactions',
        'warehouses', 'materials', 'products', 'productionOrders', 'payments',
        'saleReturns', 'purchaseReturns', 'reports',
      ]
      allTypes.forEach((t) => dataChangeEmitter.notifyUpdate(t as any))
      // عرض أعداد السجلات المسترجعة كما يرجعها السيرفر (بأسماء عربية)
      const counts = result?.counts || {}
      const countsText = Object.entries(counts)
        .filter(([, v]) => typeof v === 'number' && (v as number) > 0)
        .map(([k, v]) => `${COUNT_LABELS[k] || k}: ${v}`)
        .join('، ')
      toast({
        title: 'تم الاسترجاع',
        description: result?.message
          ? `${result.message}${countsText ? ` — ${countsText}` : ''}`
          : 'تم استرجاع البيانات بنجاح من السيرفر',
      })
      setConfirmRestore(null)
      onOpenChange(false)
      setTimeout(() => window.location.reload(), 1000)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const d = confirmRestore?.data || {}

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent variant="bottom-sheet" className="p-0" dir="rtl">
          <DialogTitle className="sr-only">النسخ الاحتياطي والاسترجاع</DialogTitle>
          <DialogDescription className="sr-only">إدارة النسخ الاحتياطية</DialogDescription>

          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <span className="text-base font-bold text-slate-800">النسخ الاحتياطي</span>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"
            >
              ✕
            </button>
          </div>

          <div className="px-4 pb-6 space-y-3">
            <div className="bg-gradient-to-l from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">البيانات على السيرفر</p>
                  <p className="text-[10px] text-slate-500">جميع البيانات محفوظة على السيرفر بأمان</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleBackup}
                disabled={exporting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-11"
              >
                <Download className="w-4 h-4 ml-1" />
                {exporting ? 'جارٍ التنزيل...' : 'تنزيل نسخة'}
              </Button>
              <Button
                onClick={() => fileRef.current?.click()}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 h-11"
              >
                <Upload className="w-4 h-4 ml-1" />
                استرجاع من ملف
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-[11px] text-blue-800 space-y-1">
                  <p className="font-bold">حماية بياناتك:</p>
                  <p>البيانات محفوظة على السيرفر. يمكنك تنزيل نسخة احتياطية في أي وقت.</p>
                </div>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-100 rounded-xl p-2 text-[11px] text-rose-700">
              <div className="flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <p>الاسترجاع سيستبدل جميع البيانات الحالية على السيرفر ببيانات الملف. تأكد من تنزيل نسخة حديثة قبل الاسترجاع.</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmRestore} onOpenChange={(v) => !v && setConfirmRestore(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              تأكيد الاسترجاع
            </DialogTitle>
            <DialogDescription className="sr-only">تأكيد استرجاع البيانات</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-slate-700">
              سيتم <span className="font-bold text-rose-600">استبدال جميع البيانات الحالية</span> ببيانات هذا الملف:
            </p>
            {confirmRestore?.exportedAt && (
              <p className="text-[11px] text-slate-500">
                تاريخ إنشاء النسخة: {new Date(confirmRestore.exportedAt).toLocaleString('ar-EG')}
              </p>
            )}
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs max-h-56 overflow-y-auto">
              <Row label="العمال" value={d?.workers?.length || 0} />
              <Row label="سلف العمال" value={d?.workerAdvances?.length || 0} />
              <Row label="قبضيات العمال" value={d?.workerReceipts?.length || 0} />
              <Row label="سجلات الحضور" value={d?.workerAttendance?.length || 0} />
              <Row label="الإنتاج" value={d?.production?.length || 0} />
              <Row label="العملاء" value={d?.customers?.length || 0} />
              <Row label="الموردون" value={d?.suppliers?.length || 0} />
              <Row label="فواتير المبيعات" value={d?.sales?.length || 0} />
              <Row label="فواتير المشتريات" value={d?.purchases?.length || 0} />
              <Row label="المصاريف" value={d?.expenses?.length || 0} />
              <Row label="المنتجات" value={d?.products?.length || 0} />
              <Row label="المواد الخام" value={d?.materials?.length || 0} />
              <Row label="المخازن" value={d?.warehouses?.length || 0} />
              <Row label="أوامر التشغيل" value={d?.productionOrders?.length || 0} />
              <Row label="السدادات" value={d?.payments?.length || 0} />
              <Row label="مرتجعات المبيعات" value={d?.saleReturns?.length || 0} />
              <Row label="مرتجعات المشتريات" value={d?.purchaseReturns?.length || 0} />
              <Row label="حركات الخزينة" value={d?.treasuryTransactions?.length || 0} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmRestore(null)} disabled={importing}>
              إلغاء
            </Button>
            <Button
              onClick={handleRestore}
              disabled={importing}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {importing ? 'جارٍ الاسترجاع...' : 'تأكيد الاسترجاع'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  )
}
