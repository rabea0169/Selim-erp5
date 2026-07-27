'use client'

import { useState, useEffect } from 'react'
import { Contact } from 'lucide-react'
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
import { formatCurrency } from '@/lib/format'
import { pickContactFromPhone, isContactsPickerSupported } from '@/lib/contacts'
import {
  customerRepository,
  dataChangeEmitter,
} from '@/lib/db'
import type { CustomerWithStats } from './CustomerCard'

interface CustomerFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  customer: CustomerWithStats | null
  onSaved: () => void
}

export function CustomerForm({
  open,
  onOpenChange,
  customer,
  onSaved,
}: CustomerFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
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
      setCreditLimit(customer.creditLimit ? String(customer.creditLimit) : '')
      setOpeningBalance(customer.openingBalance ? String(customer.openingBalance) : '')
    } else {
      setName('')
      setPhone('')
      setAddress('')
      setNotes('')
      setCreditLimit('')
      setOpeningBalance('')
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
      const creditLimitNum = Number(creditLimit) || 0
      const openingBalanceNum = Number(openingBalance) || 0

      const payload = {
        name,
        phone: phone || undefined,
        address: address || undefined,
        notes: notes || undefined,
        creditLimit: creditLimitNum > 0 ? creditLimitNum : undefined,
        openingBalance: openingBalanceNum > 0 ? openingBalanceNum : undefined,
      }
      if (customer) {
        await customerRepository.update(customer.id, payload)
        dataChangeEmitter.notifyUpdate('customers')
        toast({ title: 'تم', description: 'تم التحديث' })
      } else {
        await customerRepository.create(payload)
        dataChangeEmitter.notifyCreate('customers')
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {customer ? 'تعديل عميل' : 'عميل جديد'}
          </DialogTitle>
          <DialogDescription className="sr-only">إدارة بيانات العملاء</DialogDescription>
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

          {/* ===== الذمم والائتمان ===== */}
          <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3 space-y-2">
            <p className="text-xs font-bold text-amber-800">الذمم والائتمان</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">حد الائتمان (اختياري)</Label>
                <Input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="0"
                  className="bg-white text-sm h-8"
                  min="0"
                />
              </div>
              <div>
                <Label className="text-[10px]">رصيد افتتاحي (اختياري)</Label>
                <Input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0"
                  className="bg-white text-sm h-8"
                  min="0"
                />
              </div>
            </div>
            {customer && customer.openingBalance && customer.openingBalance > 0 && (
              <p className="text-[10px] text-amber-700">
                الرصيد الافتتاحي الحالي: {formatCurrency(customer.openingBalance)}
              </p>
            )}
          </div>

          {/* ===== نقاط الولاء (عرض فقط) ===== */}
          {customer && customer.loyaltyPoints !== undefined && (
            <div className="bg-purple-50/60 border border-purple-100 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-purple-800">نقاط الولاء</p>
                <p className="text-[10px] text-purple-600">يتم تجميعها تلقائياً مع المبيعات</p>
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {customer.loyaltyPoints || 0}
              </div>
            </div>
          )}

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
