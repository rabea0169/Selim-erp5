'use client'

import { useState } from 'react'
import {
  Trash2,
  Phone,
  MapPin,
  Pencil,
  FileText,
  HandCoins,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, todayStr } from '@/lib/format'
import { paymentRepository, dataChangeEmitter } from '@/lib/db'

export interface CustomerWithStats {
  id: string
  name: string
  phone?: string
  address?: string
  notes?: string
  createdAt?: string
  creditLimit?: number
  loyaltyPoints?: number
  openingBalance?: number
  totalSales: number
  totalPaid: number
  totalRemaining: number
  salesCount: number
}

interface CustomerCardProps {
  customer: CustomerWithStats
  onEdit: () => void
  onDelete: () => void
  onShowReport: () => void
}

export function CustomerCard({ customer: c, onEdit, onDelete, onShowReport }: CustomerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [payOpen, setPayOpen] = useState(false)

  const whatsappNumber = c.phone?.replace(/[^0-9]/g, '')
  const whatsappLink = whatsappNumber ? `https://wa.me/${whatsappNumber.startsWith('0') ? '20' + whatsappNumber.slice(1) : whatsappNumber}` : null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-3">
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
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={onShowReport} title="تقرير العميل">
              <FileText className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-600" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={onDelete}>
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

        {/* أزرار سريعة */}
        <div className="flex gap-1.5 mt-2">
          {c.totalRemaining > 0 && (
            <Button
              size="sm"
              onClick={() => setPayOpen(true)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-[10px]"
            >
              <HandCoins className="w-3 h-3 ml-1" />
              سداد
            </Button>
          )}
          {c.phone && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`tel:${c.phone}`)}
              className="h-7 text-[10px] border-slate-200"
            >
              <Phone className="w-3 h-3" />
            </Button>
          )}
          {whatsappLink && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(whatsappLink, '_blank')}
              className="h-7 text-[10px] border-green-200 text-green-700 hover:bg-green-50"
            >
              <MessageCircle className="w-3 h-3" />
            </Button>
          )}
          {c.address && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExpanded(!expanded)}
              className="h-7 text-[10px] border-slate-200"
            >
              <MapPin className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* العنوان عند التوسيع */}
        {expanded && c.address && (
          <div className="mt-2 bg-slate-50 rounded-lg p-2 text-xs text-slate-600">
            <MapPin className="w-3 h-3 inline ml-1" />
            {c.address}
          </div>
        )}
      </div>

      {/* نافذة السداد السريع */}
      <QuickPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        customerId={c.id}
        customerName={c.name}
        maxAmount={c.totalRemaining}
      />
    </div>
  )
}

// ===== نافذة سداد سريعة =====
interface QuickPaymentDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  customerId: string
  customerName: string
  maxAmount: number
}

function QuickPaymentDialog({ open, onOpenChange, customerId, customerName, maxAmount }: QuickPaymentDialogProps) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setAmount(String(maxAmount))
      setMethod('cash')
      setDate(todayStr())
      setNotes('')
    }
  }, [open, maxAmount])

  const save = async () => {
    const num = Number(amount) || 0
    if (num <= 0) {
      toast({ title: 'تنبيه', description: 'أدخل مبلغاً صحيحاً', variant: 'destructive' })
      return
    }
    if (num > maxAmount) {
      toast({ title: 'تنبيه', description: `المبلغ أكبر من المتبقي (${formatCurrency(maxAmount)})`, variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await paymentRepository.create({
        type: 'customer_payment',
        partyId: customerId,
        partyName: customerName,
        amount: num,
        date,
        method,
        notes: notes || undefined,
      })
      dataChangeEmitter.notifyUpdate('payments')
      dataChangeEmitter.notifyUpdate('sales')
      dataChangeEmitter.notifyUpdate('customers')
      toast({ title: 'تم', description: `تم تسجيل سداد ${formatCurrency(num)} من ${customerName}` })
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl" variant="bottom-sheet">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-right">سداد - {customerName}</DialogTitle>
          <DialogDescription className="sr-only">تسجيل سداد دفعة من العميل</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-1 pb-2">
          <div className="bg-rose-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-rose-700">المتبقي</p>
            <p className="text-lg font-bold text-rose-900">{formatCurrency(maxAmount)}</p>
          </div>
          <div>
            <Label className="text-xs">مبلغ السداد *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="bg-slate-50" min="0" />
            <button type="button" onClick={() => setAmount(String(maxAmount))} className="text-[10px] text-emerald-600 hover:underline mt-1">
              سداد المتبقي كاملاً
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">طريقة السداد</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">كاش</SelectItem>
                  <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-slate-50" />
            </div>
          </div>
          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات..." className="bg-slate-50 text-sm" rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2 px-1 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={save} disabled={saving || !amount || Number(amount) <= 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? 'جارٍ الحفظ...' : 'تسجيل السداد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}