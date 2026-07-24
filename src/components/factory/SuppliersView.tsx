'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Truck,
  Phone,
  MapPin,
  Pencil,
  X,
  FileText,
  TrendingUp,
  Contact,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, todayStr, startOfMonth } from '@/lib/format'
import { pickContactFromPhone, isContactsPickerSupported } from '@/lib/contacts'
import {
  supplierRepository,
  dataChangeEmitter,
  useLiveData,
} from '@/lib/db'
import {
  getFactorySettings,
  buildFactoryHeader,
  buildFactoryFooter,
} from '@/lib/factory-header'

interface Supplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  totalPurchases: number
  totalPaid: number
  totalRemaining: number
  purchasesCount: number
}

// جلب الموردين مع الإحصائيات (يدعم البحث)
async function fetchSuppliers(search: string): Promise<Supplier[]> {
  const data = search
    ? await supplierRepository.search(search)
    : await supplierRepository.getAllWithStats()
  return data as Supplier[]
}

export function SuppliersView({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [reportSupplier, setReportSupplier] = useState<Supplier | null>(null)
  const { toast } = useToast()

  // تحميل الموردين مع التحديث الفوري
  const { data: suppliers, loading, reload } = useLiveData<Supplier[]>(
    () => fetchSuppliers(search),
    ['suppliers', 'purchases']
  )

  // إعادة التحميل عند تغير البحث
  useEffect(() => {
    reload()
  }, [search, reload])

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا المورد؟')) return
    try {
      await supplierRepository.delete(id)
      dataChangeEmitter.notifyDelete('suppliers')
      toast({ title: 'تم الحذف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const suppliersList = suppliers || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
            <X className="w-4 h-4 ml-1" />
            رجوع
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">الموردين</h2>
            <p className="text-xs text-slate-500">إدارة بيانات الموردين وتقاريرهم</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditSupplier(null)
            setOpen(true)
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="w-4 h-4 ml-1" />
          مورد جديد
        </Button>
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : suppliersList.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا يوجد موردين مسجلين</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliersList.map((s) => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{s.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      {s.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {s.phone}
                        </span>
                      )}
                      {s.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {s.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-blue-600"
                    onClick={() => setReportSupplier(s)}
                    title="تقرير المورد"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-slate-600"
                    onClick={() => {
                      setEditSupplier(s)
                      setOpen(true)
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-rose-600"
                    onClick={() => handleDelete(s.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-amber-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-amber-700">إجمالي المشتريات</p>
                  <p className="font-bold text-amber-900">{formatCurrency(s.totalPurchases)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-blue-700">المدفوع</p>
                  <p className="font-bold text-blue-900">{formatCurrency(s.totalPaid)}</p>
                </div>
                <div className="bg-rose-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-rose-700">المتبقي له</p>
                  <p className="font-bold text-rose-900">{formatCurrency(s.totalRemaining)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SupplierForm
        open={open}
        onOpenChange={setOpen}
        supplier={editSupplier}
        onSaved={() => setOpen(false)}
      />
      {reportSupplier && (
        <SupplierReport supplier={reportSupplier} onClose={() => setReportSupplier(null)} />
      )}
    </div>
  )
}

function SupplierForm({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  supplier: Supplier | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const contactsSupported = isContactsPickerSupported()
  const { toast } = useToast()

  useEffect(() => {
    if (supplier) {
      setName(supplier.name)
      setPhone(supplier.phone || '')
      setAddress(supplier.address || '')
      setNotes(supplier.notes || '')
    } else {
      setName('')
      setPhone('')
      setAddress('')
      setNotes('')
    }
  }, [supplier, open])

  const pickFromContacts = async () => {
    setPicking(true)
    try {
      const contact = await pickContactFromPhone()
      if (contact) {
        if (contact.name) setName(contact.name)
        if (contact.phone) setPhone(contact.phone)
        toast({ title: 'تم', description: 'تم تعبئة البيانات من جهة الاتصال' })
      }
    } catch (e: any) {
      toast({ title: 'تعذر الاختيار', description: e.message, variant: 'destructive' })
    } finally {
      setPicking(false)
    }
  }

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'تنبيه', description: 'أدخل اسم المورد', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = { name, phone: phone || undefined, address: address || undefined, notes: notes || undefined }
      if (supplier) {
        await supplierRepository.update(supplier.id, payload)
        dataChangeEmitter.notifyUpdate('suppliers')
        toast({ title: 'تم', description: 'تم التحديث' })
      } else {
        await supplierRepository.create(payload)
        dataChangeEmitter.notifyCreate('suppliers')
        toast({ title: 'تم', description: 'تمت الإضافة' })
      }
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{supplier ? 'تعديل مورد' : 'مورد جديد'}</DialogTitle>
          <DialogDescription className="sr-only">إدارة بيانات الموردين</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {contactsSupported && (
            <Button
              type="button"
              variant="outline"
              onClick={pickFromContacts}
              disabled={picking}
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 bg-amber-50/50"
            >
              <Contact className="w-4 h-4 ml-2" />
              {picking ? 'جارٍ الفتح...' : 'اختيار من جهات الاتصال'}
            </Button>
          )}
          <div>
            <Label className="text-xs">الاسم *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="text-xs">الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="text-xs">العنوان</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-slate-50" rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SupplierReport({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  // جلب إحصائيات المورد مع التحديث الفوري
  const { data, loading, reload } = useLiveData<any>(async () => {
    const stats = await supplierRepository.getWithStats(supplier.id)
    if (!stats) return null
    const fromTime = from ? new Date(from).getTime() : 0
    const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Date.now()
    const filteredPurchases = stats.purchases.filter((p) => {
      const t = new Date(p.date).getTime()
      return t >= fromTime && t <= toTime
    })
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + p.total, 0)
    const totalPaid = filteredPurchases.reduce((sum, p) => sum + p.paid, 0)
    return {
      ...stats,
      purchases: filteredPurchases,
      totalPurchases,
      totalPaid,
      totalRemaining: totalPurchases - totalPaid,
      purchasesCount: filteredPurchases.length,
      summary: {
        purchasesCount: filteredPurchases.length,
        totalPurchases,
        totalPaid,
        totalRemaining: totalPurchases - totalPaid,
      },
    }
  }, ['purchases'])

  const exportPDF = async () => {
    if (!data) return
    setExporting(true)
    try {
      const { exportElementToPDF, shareViaWhatsApp, createReportContainer, cleanupContainer } =
        await import('@/lib/pdf-export')

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

      const contentHtml = `
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

      const container = createReportContainer(`تقرير المورد: ${supplier.name}`, contentHtml)
      await new Promise((r) => setTimeout(r, 100))
      const file = await exportElementToPDF(container, `تقرير-المورد-${supplier.name}.pdf`)
      cleanupContainer(container)

      toast({ title: 'تم', description: 'تم إنشاء PDF - جارٍ المشاركة عبر الواتساب' })
      await shareViaWhatsApp(file, `تقرير المورد: ${supplier.name}\nالفترة: ${formatDate(from)} إلى ${formatDate(to)}`)
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
          <DialogDescription className="sr-only">إدارة بيانات الموردين</DialogDescription>
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

              {data.purchases?.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-lg max-h-60 overflow-y-auto">
                  {data.purchases.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 border-b border-slate-50 text-xs last:border-0">
                      <div>
                        <p className="font-medium text-slate-800">{formatDate(p.date)}</p>
                        <p className="text-[10px] text-slate-500">{p.items?.length || 0} صنف</p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-amber-700">{formatCurrency(p.total)}</p>
                        <p className="text-[10px] text-rose-600">متبقي: {formatCurrency(p.total - p.paid)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={exportPDF}
                disabled={exporting}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
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
