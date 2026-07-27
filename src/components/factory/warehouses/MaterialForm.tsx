'use client'

import { useState, useEffect } from 'react'
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
import {
  materialRepository,
  dataChangeEmitter,
  type Warehouse,
} from '@/lib/db'

interface MaterialFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  warehouseId: string | null
  warehouses: Warehouse[]
  onSaved: () => void
}

export function MaterialForm({
  open,
  onOpenChange,
  warehouseId,
  warehouses,
  onSaved,
}: MaterialFormProps) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('متر')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(warehouseId || '')
  const [quantity, setQuantity] = useState('0')
  const [unitCost, setUnitCost] = useState('')
  const [reorderLevel, setReorderLevel] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // لما warehouseId prop يتغير - حدث القيمة
  useEffect(() => {
    if (warehouseId) setSelectedWarehouseId(warehouseId)
  }, [warehouseId])

  const reset = () => {
    setName('')
    setUnit('متر')
    setQuantity('0')
    setUnitCost('')
    setReorderLevel('')
    setNotes('')
  }

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'أدخل اسم المادة', variant: 'destructive' })
      return
    }
    if (!selectedWarehouseId) {
      toast({ title: 'اختر المخزن', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await materialRepository.create({
        name: name.trim(),
        unit: unit.trim() || 'قطعة',
        warehouseId: selectedWarehouseId,
        quantity: Number(quantity) || 0,
        unitCost: Number(unitCost) || 0,
        reorderLevel: reorderLevel ? Number(reorderLevel) : undefined,
        notes: notes.trim() || undefined,
      })
      dataChangeEmitter.notifyCreate('materials')
      reset()
      onSaved()
      toast({ title: 'تم إضافة المادة' })
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
          <DialogTitle className="text-right">مادة جديدة</DialogTitle>
          <DialogDescription className="sr-only">إدارة المخازن والمواد</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">اسم المادة *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: قماش قطن"
              className="bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">الوحدة</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="متر / كجم / قطعة"
                className="bg-slate-50"
              />
            </div>
            <div>
              <Label className="text-xs">الكمية الابتدائية</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-slate-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">تكلفة الوحدة</Label>
              <Input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
                className="bg-slate-50"
              />
            </div>
            <div>
              <Label className="text-xs">حد إعادة الطلب</Label>
              <Input
                type="number"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="اختياري"
                className="bg-slate-50"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">المخزن *</Label>
            <Select
              value={selectedWarehouseId || '__none__'}
              onValueChange={(v) => setSelectedWarehouseId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="اختر المخزن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— اختر —</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية..."
              className="bg-slate-50 text-sm"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-9 text-xs font-medium"
          >
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs font-medium"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ المادة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
