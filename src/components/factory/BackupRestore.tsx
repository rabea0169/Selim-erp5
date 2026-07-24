'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  HardDrive,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle,
  RefreshCw,
  Settings2,
  FileDown,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { reportRepository, dataChangeEmitter, autoBackupService, type BackupInfo } from '@/lib/db'

export function BackupRestore({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<any>(null)
  const [autoEnabled, setAutoEnabled] = useState(autoBackupService.isEnabled())
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(autoBackupService.getLastBackupInfo())
  const [cacheCount, setCacheCount] = useState(0)
  const [restoringCache, setRestoringCache] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      Promise.resolve().then(async () => {
        setBackupInfo(autoBackupService.getLastBackupInfo())
        const count = await autoBackupService.getCacheBackupsCount()
        setCacheCount(count)
      })
    }
  }, [open])

  const handleBackup = async () => {
    setExporting(true)
    try {
      const info = await autoBackupService.downloadBackup()
      if (info) {
        setBackupInfo(info)
        toast({
          title: 'تم تنزيل النسخة الاحتياطية',
          description: `${info.fileName} (${info.size}) - ${info.recordsCount} سجل`,
        })
      } else {
        toast({ title: 'خطأ', description: 'فشل التنزيل', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleAutoToggle = (enabled: boolean) => {
    setAutoEnabled(enabled)
    autoBackupService.setEnabled(enabled)
    toast({
      title: enabled ? 'تم التفعيل' : 'تم التعطيل',
      description: enabled
        ? 'سيتم تنزيل نسخة احتياطية تلقائياً كل يوم في مجلد Downloads'
        : 'النسخ التلقائي معطل',
    })
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
      // إشعار كل الأقسام بالتحديث
      const allTypes = [
        'sales', 'purchases', 'workers', 'workerAdvances', 'workerReceipts',
        'workerAttendance', 'production', 'customers', 'suppliers', 'expenses',
        'expenseCategories', 'factorySettings', 'treasuryTransactions',
        'warehouses', 'materials', 'materialTransactions', 'products',
        'productionOrders', 'payments', 'saleReturns', 'purchaseReturns', 'reports',
      ]
      allTypes.forEach((t) => dataChangeEmitter.notifyUpdate(t as any))

      toast({
        title: 'تم الاسترجاع',
        description: `تم استرجاع البيانات بنجاح (${result.counts.workers} موظف، ${result.counts.customers} عميل، ${result.counts.sales} مبيعة)`,
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

  // استرجاع من Cache API
  const handleRestoreFromCache = async () => {
    setRestoringCache(true)
    try {
      const data = await autoBackupService.getLastCacheBackup()
      if (!data) {
        toast({ title: 'لا توجد نسخ', description: 'مفيش نسخ محفوظة في الذاكرة', variant: 'destructive' })
        return
      }
      setConfirmRestore(data)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setRestoringCache(false)
    }
  }

  const lastBackupDate = autoBackupService.getLastBackupDate()
  const isStale = autoBackupService.isBackupStale()

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          variant="bottom-sheet"
          className="p-0"
          dir="rtl"
        >
          <DialogTitle className="sr-only">النسخ الاحتياطي والاسترجاع</DialogTitle>
          <DialogDescription className="sr-only">إدارة النسخ الاحتياطية والاسترجاع</DialogDescription>

          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <span className="text-base font-bold text-slate-800">النسخ الاحتياطي</span>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"
            >
              ✕
            </button>
          </div>

          <div className="px-4 pb-6 space-y-3 overflow-y-auto max-h-[75vh]">

            {/* حالة النسخ التلقائي */}
            <div className="bg-gradient-to-l from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">النسخ التلقائي اليومي</p>
                    <p className="text-[10px] text-slate-500">ينزل ملف في Downloads كل يوم</p>
                  </div>
                </div>
                <Switch
                  checked={autoEnabled}
                  onCheckedChange={handleAutoToggle}
                />
              </div>

              {/* معلومات آخر نسخة */}
              {backupInfo ? (
                <div className="bg-white/80 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-slate-700 font-medium">آخر نسخة: {backupInfo.fileName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    {lastBackupDate?.toLocaleString('ar-EG')}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <HardDrive className="w-3 h-3" />
                    الحجم: {backupInfo.size} • {backupInfo.recordsCount} سجل
                  </div>
                  {isStale && autoEnabled && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      النسخة قديمة - اضغط "تنزيل الآن"
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white/80 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">لم يتم إنشاء نسخة احتياطية بعد</p>
                </div>
              )}

              {/* نسخ Cache */}
              {cacheCount > 0 && (
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                  <Database className="w-3 h-3" />
                  يوجد {cacheCount} نسخة احتياطية في الذاكرة المؤقتة
                </div>
              )}
            </div>

            {/* أزرار التنزيل */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleBackup}
                disabled={exporting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-11"
              >
                <FileDown className="w-4 h-4 ml-1" />
                {exporting ? 'جارٍ التنزيل...' : 'تنزيل الآن'}
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

            {/* استرجاع من الذاكرة */}
            {cacheCount > 0 && (
              <Button
                onClick={handleRestoreFromCache}
                disabled={restoringCache}
                variant="outline"
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 h-10"
                size="sm"
              >
                <RefreshCw className="w-3.5 h-3.5 ml-1" />
                {restoringCache ? 'جارٍ البحث...' : `استرجاع من الذاكرة (${cacheCount} نسخة)`}
              </Button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* معلومة مهمة */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-[11px] text-blue-800 space-y-1">
                  <p className="font-bold">💾 حماية بياناتك:</p>
                  <p>• الملفات بتتنزل في مجلد <strong>Downloads</strong> على جهازك</p>
                  <p>• الملفات بتفضل موجودة حتى لو مسحت المتصفح</p>
                  <p>• خزّن نسخة على <strong>Google Drive</strong> أو <strong>واتساب</strong> أسبوعياً</p>
                  <p>• لو غيرت الموبايل: استرجع من الملف المحفوظ</p>
                </div>
              </div>
            </div>

            {/* تحذير */}
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-2 text-[11px] text-rose-700">
              <div className="flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <p>الاسترجاع سيستبدل كل البيانات الحالية. تأكد من حفظ نسخة قبل الاسترجاع.</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* تأكيد الاسترجاع */}
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
            <p className="text-slate-700">سيتم استبدال البيانات الحالية:</p>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs">
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
