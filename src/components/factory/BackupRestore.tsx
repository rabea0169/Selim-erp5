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
      // تنزيل الملف
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `selim-erp-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'تم تنزيل النسخة الاحتياطية' })
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
      const allTypes = [
        'sales', 'purchases', 'workers', 'workerAdvances', 'workerReceipts',
        'workerAttendance', 'production', 'customers', 'suppliers', 'expenses',
        'expenseCategories', 'factorySettings', 'treasuryTransactions',
        'warehouses', 'materials', 'products', 'productionOrders', 'payments',
        'saleReturns', 'purchaseReturns', 'reports',
      ]
      allTypes.forEach((t) => dataChangeEmitter.notifyUpdate(t as any))
      toast({
        title: 'تم الاسترجاع',
        description: 'تم استرجاع البيانات بنجاح من السيرفر',
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
                <p>الاسترجاع سيؤثر على البيانات الحالية على السيرفر. تأكد من حفظ نسخة قبل الاسترجاع.</p>
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
            <p className="text-slate-700">سيتم استيراد البيانات من الملف إلى السيرفر:</p>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs">
              <Row label="العمال" value={confirmRestore?.data?.workers?.length || 0} />
              <Row label="العملاء" value={confirmRestore?.data?.customers?.length || 0} />
              <Row label="الموردين" value={confirmRestore?.data?.suppliers?.length || 0} />
              <Row label="المبيعات" value={confirmRestore?.data?.sales?.length || 0} />
              <Row label="المشتريات" value={confirmRestore?.data?.purchases?.length || 0} />
              <Row label="المصاريف" value={confirmRestore?.data?.expenses?.length || 0} />
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
