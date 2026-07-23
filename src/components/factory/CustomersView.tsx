'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Users,
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
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, todayStr, startOfMonth } from '@/lib/format'
import { pickContactFromPhone, isContactsPickerSupported } from '@/lib/contacts'
import { customerRepository } from '@/lib/db'

interface Customer {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  totalSales: number
  totalPaid: number
  totalRemaining: number
  salesCount: number
}

export function CustomersView({ onBack }: { onBack: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [reportCustomer, setReportCustomer] = useState<Customer | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = search
        ? await customerRepository.search(search)
        : await customerRepository.getAllWithStats()
      setCustomers(data as Customer[])
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل العملاء', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, toast])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا العميل؟')) return
    try {
      await customerRepository.delete(id)
      toast({ title: 'تم الحذف' })
      load()
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
            <X className="w-4 h-4 ml-1" />
            رجوع
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">العملاء</h2>
            <p className="text-xs text-slate-500">إدارة بيانات العملاء وتقاريرهم</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditCustomer(null)
            setOpen(true)
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 ml-1" />
          عميل جديد
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
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا يوجد عملاء مسجلين</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl shadow-sm border border-slate-100 p-3"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{c.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </span>
                      )}
                      {c.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {c.address}
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
                    onClick={() => setReportCustomer(c)}
                    title="تقرير العميل"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-slate-600"
                    onClick={() => {
                      setEditCustomer(c)
                      setOpen(true)
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-rose-600"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-emerald-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-emerald-700">إجمالي المبيعات</p>
                  <p className="font-bold text-emerald-900">{formatCurrency(c.totalSales)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-blue-700">المدفوع</p>
                  <p className="font-bold text-blue-900">{formatCurrency(c.totalPaid)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-amber-700">المتبقي</p>
                  <p className="font-bold text-amber-900">{formatCurrency(c.totalRemaining)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomerForm
        open={open}
        onOpenChange={setOpen}
        customer={editCustomer}
        onSaved={() => {
          setOpen(false)
          load()
        }}
      />
      {reportCustomer && (
        <CustomerReport
          customer={reportCustomer}
          onClose={() => setReportCustomer(null)}
        />
      )}
    </div>
  )
}

function CustomerForm({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  customer: Customer | null
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
    if (customer) {
      setName(customer.name)
      setPhone(customer.phone || '')
      setAddress(customer.address || '')
      setNotes(customer.notes || '')
    } else {
      setName('')
      setPhone('')
      setAddress('')
      setNotes('')
    }
  }, [customer, open])

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
      toast({ title: 'تنبيه', description: 'أدخل اسم العميل', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = { name, phone: phone || undefined, address: address || undefined, notes: notes || undefined }
      if (customer) {
        await customerRepository.update(customer.id, payload)
        toast({ title: 'تم', description: 'تم التحديث' })
      } else {
        await customerRepository.create(payload)
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
          <DialogTitle className="text-right">
            {customer ? 'تعديل عميل' : 'عميل جديد'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {contactsSupported && (
            <Button
              type="button"
              variant="outline"
              onClick={pickFromContacts}
              disabled={picking}
              className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50"
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CustomerReport({
  customer,
  onClose,
}: {
  customer: Customer
  onClose: () => void
}) {
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const stats = await customerRepository.getWithStats(customer.id)
      if (!stats) {
        setData(null)
        return
      }
      const fromTime = from ? new Date(from).getTime() : 0
      const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Date.now()
      const filteredSales = stats.sales.filter((s) => {
        const t = new Date(s.date).getTime()
        return t >= fromTime && t <= toTime
      })
      const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0)
      const totalPaid = filteredSales.reduce((sum, s) => sum + s.paid, 0)
      setData({
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
      })
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل التقرير', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [customer.id, from, to, toast])

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [load])

  const exportPDF = async () => {
    if (!data) return
    setExporting(true)
    try {
      const { exportElementToPDF, shareViaWhatsApp, createReportContainer, cleanupContainer } =
        await import('@/lib/pdf-export')

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
          <Button onClick={load} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="sm">
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

