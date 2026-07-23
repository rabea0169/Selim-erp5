'use client'

import { useState } from 'react'
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
import { pickContactFromPhone, isContactsPickerSupported } from '@/lib/contacts'
import { workerRepository, dataChangeEmitter } from '@/lib/db'

interface WorkerFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

export function WorkerForm({ open, onOpenChange, onSaved }: WorkerFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [job, setJob] = useState('')
  const [type, setType] = useState<'monthly' | 'production'>('monthly')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const contactsSupported = isContactsPickerSupported()
  const { toast } = useToast()

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
      toast({ title: 'تنبيه', description: 'أدخل اسم العامل', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await workerRepository.create({
        name,
        phone: phone || undefined,
        job: job || undefined,
        type,
        notes: notes || undefined,
      })
      dataChangeEmitter.notifyCreate('workers')
      toast({ title: 'تم', description: 'تمت إضافة العامل' })
      setName('')
      setPhone('')
      setJob('')
      setType('monthly')
      setNotes('')
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
          <DialogTitle className="text-right">عامل جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {contactsSupported && (
            <Button
              type="button"
              variant="outline"
              onClick={pickFromContacts}
              disabled={picking}
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 bg-purple-50/50"
            >
              <Contact className="w-4 h-4 ml-2" />
              {picking ? 'جارٍ الفتح...' : 'اختيار من جهات الاتصال'}
            </Button>
          )}
          <div>
            <Label className="text-xs">اسم العامل *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">الهاتف</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-slate-50" />
            </div>
            <div>
              <Label className="text-xs">الوظيفة</Label>
              <Input value={job} onChange={(e) => setJob(e.target.value)} className="bg-slate-50" placeholder="خياط / تفصيل..." />
            </div>
          </div>
          <div>
            <Label className="text-xs">نوع العامل</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'monthly' | 'production')}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">مرتب شهري</SelectItem>
                <SelectItem value="production">إنتاج بالقطعة</SelectItem>
              </SelectContent>
            </Select>
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
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
