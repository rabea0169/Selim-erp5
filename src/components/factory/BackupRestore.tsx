'use client'

import { useState, useRef } from 'react'
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  HardDrive,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { reportRepository, dataChangeEmitter } from '@/lib/db'

export function BackupRestore({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<any>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleBackup = async () => {
    setExporting(true)
    try {
      const data = await reportRepository.exportAll()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factory-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'تم', description: 'تم تنزيل النسخة الاحتياطية' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!data.data) {
          toast({ title: 'خطأ', description: 'ملف النسخة الاحتياطية غير صالح', variant: 'destructive' })
          return
        }
        setConfirmRestore(data)
      } catch {
        toast({ title: 'خطأ', description: 'تعذرت قراءة الملف', variant: 'destructive' })
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
      toast({
        title: 'تم الاسترجاع',
        description: `تم استرجاع البيانات بنجاح (${result.counts.workers} عامل، ${result.counts.customers} عميل، ${result.counts.sales} مبيعة)`,
      })
      setConfirmRestore(null)
      onOpenChange(false)
      // بث تحديث لكل الكيانات حتى تتحدث كل المكونات تلقائياً
      ;[
        'sales', 'purchases', 'workers', 'workerAdvances', 'workerReceipts',
        'workerAttendance', 'production', 'customers', 'suppliers',
        'expenses', 'expenseCategories', 'factorySettings', 'reports',
      ].forEach((type) => {
        dataChangeEmitter.notifyUpdate(type as any)
      })
      // إعادة تحميل الصفحة
      setTimeout(() => window.location.reload(), 1000)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              النسخ الاحتياطي والاسترجاع
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* حالة الاتصال */}
            <div className={`rounded-lg p-3 text-xs flex items-center gap-2 ${
              isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span>
                {isOnline ? 'أنت متصل بالإنترنت' : 'تطبيق offline - كل البيانات على جهازك'}
              </span>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              <div className="flex items-start gap-2">
                <HardDrive className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  كل بياناتك محفوظة محلياً على جهازك في <strong>IndexedDB</strong> -
                  تعمل بدون إنترنت تماماً. يُنصح بعمل نسخة احتياطية أسبوعياً.
                </p>
              </div>
            </div>

            {/* Backup */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-bold text-slate-800">تنزيل نسخة احتياطية</p>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                يحفظ كل البيانات في ملف JSON
              </p>
              <Button
                onClick={handleBackup}
                disabled={exporting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
              >
                <Download className="w-4 h-4 ml-1" />
                {exporting ? 'جارٍ التنزيل...' : 'تنزيل النسخة'}
              </Button>
            </div>

            {/* Restore */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-bold text-slate-800">استرجاع من نسخة</p>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                استرجاع البيانات من ملف نسخة احتياطية
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                variant="outline"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                size="sm"
              >
                <Upload className="w-4 h-4 ml-1" />
                اختيار ملف النسخة
              </Button>
            </div>

            <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 text-[11px] text-rose-700">
              <div className="flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <p>الاسترجاع سيحذف كل البيانات الحالية ويستبدلها ببيانات الملف</p>
              </div>
            </div>
          </div>
        </DialogContent>

        {/* Confirm restore */}
        <Dialog open={!!confirmRestore} onOpenChange={(v) => !v && setConfirmRestore(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                تأكيد الاسترجاع
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p className="text-slate-700">سيتم استبدال البيانات الحالية ببيانات الملف التالي:</p>
              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs">
                <Row label="تاريخ النسخة" value={confirmRestore?.exportedAt ? new Date(confirmRestore.exportedAt).toLocaleString('ar-EG') : '-'} />
                <Row label="العمال" value={confirmRestore?.data?.workers?.length || 0} />
                <Row label="العملاء" value={confirmRestore?.data?.customers?.length || 0} />
                <Row label="الموردين" value={confirmRestore?.data?.suppliers?.length || 0} />
                <Row label="المبيعات" value={confirmRestore?.data?.sales?.length || 0} />
                <Row label="المشتريات" value={confirmRestore?.data?.purchases?.length || 0} />
                <Row label="المصاريف" value={confirmRestore?.data?.expenses?.length || 0} />
              </div>
              <p className="text-rose-600 text-xs font-bold">
                ⚠️ سيتم حذف كل البيانات الحالية نهائياً!
              </p>
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
