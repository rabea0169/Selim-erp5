'use client'

import { useState } from 'react'
import { Contact, Clock, Calendar, Banknote } from 'lucide-react'
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

type WorkerType = 'monthly' | 'production' | 'hourly'

export function WorkerForm({ open, onOpenChange, onSaved }: WorkerFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [job, setJob] = useState('')
  const [type, setType] = useState<WorkerType>('monthly')
  const [notes, setNotes] = useState('')

  // إعدادات الساعات (للنوع hourly)
  const [hourlyRate, setHourlyRate] = useState('')
  const [overtimeRate, setOvertimeRate] = useState('')
  const [workStartTime, setWorkStartTime] = useState('09:00')
  const [workHoursPerDay, setWorkHoursPerDay] = useState('8')

  // المرتب الشهري (للنوع monthly)
  const [monthlySalary, setMonthlySalary] = useState('')

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

  const resetForm = () => {
    setName('')
    setPhone('')
    setJob('')
    setType('monthly')
    setNotes('')
    setHourlyRate('')
    setOvertimeRate('')
    setWorkStartTime('09:00')
    setWorkHoursPerDay('8')
    setMonthlySalary('')
  }

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'تنبيه', description: 'أدخل اسم الموظف', variant: 'destructive' })
      return
    }

    // التحقق من الحقول حسب النوع
    if (type === 'hourly' && !hourlyRate) {
      toast({ title: 'تنبيه', description: 'أدخل سعر الساعة العادية', variant: 'destructive' })
      return
    }
    if (type === 'monthly' && !monthlySalary) {
      toast({ title: 'تنبيه', description: 'أدخل المرتب الشهري', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      // تجهيز البيانات حسب النوع
      const payload: Parameters<typeof workerRepository.create>[0] = {
        name,
        phone: phone || undefined,
        job: job || undefined,
        type,
        notes: notes || undefined,
      }

      if (type === 'hourly') {
        const rate = Number(hourlyRate) || 0
        payload.hourlyRate = rate
        // سعر الساعة الإضافية: لو مُدخل استخدمه، غير كذلك افتراضي 1.5x
        payload.overtimeRate = overtimeRate
          ? Number(overtimeRate)
          : rate * 1.5
        payload.workStartTime = workStartTime || '09:00'
        payload.workHoursPerDay = Number(workHoursPerDay) || 8
      } else if (type === 'monthly') {
        payload.monthlySalary = Number(monthlySalary) || 0
        // وقت بدء العمل وساعاته مفيدة لمرتب شهري كمان (لحساب الإضافي والتأخير)
        if (workStartTime) payload.workStartTime = workStartTime
        if (workHoursPerDay) payload.workHoursPerDay = Number(workHoursPerDay)
      }

      await workerRepository.create(payload)
      dataChangeEmitter.notifyCreate('workers')
      toast({ title: 'تم', description: 'تمت إضافة الموظف' })
      resetForm()
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // حساب الافتراضي لسعر الساعة الإضافية للعرض
  const suggestedOvertime = hourlyRate
    ? (Number(hourlyRate) * 1.5).toFixed(2)
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">موظف جديد</DialogTitle>
          <DialogDescription className="sr-only">إضافة موظف جديد</DialogDescription>
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
            <Label className="text-xs">اسم الموظف *</Label>
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
            <Label className="text-xs">نوع الموظف</Label>
            <Select value={type} onValueChange={(v) => setType(v as WorkerType)}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">مرتب شهري</SelectItem>
                <SelectItem value="production">إنتاج بالقطعة</SelectItem>
                <SelectItem value="hourly">بالساعة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* إعدادات المرتب الشهري - تظهر فقط للنوع monthly */}
          {type === 'monthly' && (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5" />
                إعدادات المرتب الشهري
              </p>
              <div>
                <Label className="text-xs">المرتب الشهري (ج.م) *</Label>
                <Input
                  type="number"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  className="bg-white"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* إعدادات الساعة - تظهر فقط للنوع hourly */}
          {type === 'hourly' && (
            <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                إعدادات الساعات
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">سعر الساعة العادية (ج.م) *</Label>
                  <Input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="bg-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-xs">سعر الساعة الإضافية (اختياري)</Label>
                  <Input
                    type="number"
                    value={overtimeRate}
                    onChange={(e) => setOvertimeRate(e.target.value)}
                    className="bg-white"
                    placeholder={suggestedOvertime || '0.00'}
                  />
                </div>
              </div>
              {suggestedOvertime && !overtimeRate && (
                <p className="text-[10px] text-amber-700">
                  الافتراضي: 1.5 × السعر العادي = {suggestedOvertime} ج.م
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    وقت بدء العمل
                  </Label>
                  <Input
                    type="time"
                    value={workStartTime}
                    onChange={(e) => setWorkStartTime(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs">عدد ساعات العمل اليومية</Label>
                  <Input
                    type="number"
                    value={workHoursPerDay}
                    onChange={(e) => setWorkHoursPerDay(e.target.value)}
                    className="bg-white"
                    placeholder="8"
                  />
                </div>
              </div>
            </div>
          )}

          {/* وقت العمل مفيد للمرتب الشهري كمان لحساب التأخير والإضافي */}
          {type === 'monthly' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  وقت بدء العمل (اختياري)
                </Label>
                <Input
                  type="time"
                  value={workStartTime}
                  onChange={(e) => setWorkStartTime(e.target.value)}
                  className="bg-slate-50"
                />
              </div>
              <div>
                <Label className="text-xs">ساعات العمل اليومية (اختياري)</Label>
                <Input
                  type="number"
                  value={workHoursPerDay}
                  onChange={(e) => setWorkHoursPerDay(e.target.value)}
                  className="bg-slate-50"
                  placeholder="8"
                />
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
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
