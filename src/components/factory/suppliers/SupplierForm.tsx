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
import { pickContactFromPhone, isContactsPickerSupported } from '@/lib/contacts'
import {
  supplierRepository,
  dataChangeEmitter,
} from '@/lib/db'
import type { SupplierWithStats } from './SupplierCard'

interface SupplierFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  supplier: SupplierWithStats | null
  onSaved: () => void
}

export function SupplierForm({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: SupplierFormProps) {
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
      const payload = {
        name,
        phone: phone || undefined,
        address: address || undefined,
        notes: notes || undefined,
      }
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
