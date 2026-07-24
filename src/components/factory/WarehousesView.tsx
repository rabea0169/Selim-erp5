'use client'

import { useState } from 'react'
import {
  Plus,
  Sparkles,
  Boxes,
  History,
  Warehouse as WarehouseIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import {
  warehouseRepository,
  materialRepository,
  materialTransactionRepository,
  dataChangeEmitter,
  useLiveData,
  type Warehouse,
  type Material,
  type MaterialTransaction,
} from '@/lib/db'
import { WarehouseCard } from './warehouses/WarehouseCard'
import { MaterialList } from './warehouses/MaterialList'
import { MaterialForm } from './warehouses/MaterialForm'
import { TransactionList } from './warehouses/TransactionList'

interface WarehousesData {
  warehouses: Warehouse[]
  materials: Material[]
  transactions: MaterialTransaction[]
}

async function fetchWarehousesData(): Promise<WarehousesData> {
  const [warehouses, transactions] = await Promise.all([
    warehouseRepository.getAll(),
    materialTransactionRepository.getAll(),
  ])
  // اجلب كل المواد
  const materials: Material[] = []
  for (const w of warehouses) {
    const ms = await materialRepository.getByWarehouse(w.id)
    materials.push(...ms)
  }
  return {
    warehouses: warehouses.sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    materials,
    transactions,
  }
}

export function WarehousesView() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  const [showTransactions, setShowTransactions] = useState(false)
  const [openWarehouse, setOpenWarehouse] = useState(false)
  const [openMaterial, setOpenMaterial] = useState(false)
  const { toast } = useToast()

  const { data, loading, reload } = useLiveData<WarehousesData>(
    () => fetchWarehousesData(),
    ['warehouses', 'materials', 'materialTransactions']
  )

  const warehouses: Warehouse[] = data?.warehouses || []
  const allMaterials: Material[] = data?.materials || []
  const allTransactions: MaterialTransaction[] = data?.transactions || []

  // لو محدد مخزن - اعرض تفاصيله
  const selectedWarehouse = selectedWarehouseId
    ? warehouses.find((w) => w.id === selectedWarehouseId)
    : null
  const selectedMaterials = selectedWarehouseId
    ? allMaterials.filter((m) => m.warehouseId === selectedWarehouseId)
    : []

  const handleSeedDefaults = async () => {
    if (!confirm('سيتم إنشاء المخازن الافتراضية (مواد خام + منتجات منتهية)؟')) return
    try {
      await warehouseRepository.seedDefaults()
      dataChangeEmitter.notifyCreate('warehouses')
      toast({ title: 'تمت تهيئة المخازن الافتراضية' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const handleDeleteWarehouse = async (id: string) => {
    if (!confirm('حذف هذا المخزن؟ يجب أن يكون فارغاً من المواد.')) return
    const mats = allMaterials.filter((m) => m.warehouseId === id)
    if (mats.length > 0) {
      toast({
        title: 'لا يمكن الحذف',
        description: `يوجد ${mats.length} مادة في المخزن`,
        variant: 'destructive',
      })
      return
    }
    try {
      await warehouseRepository.delete(id)
      dataChangeEmitter.notifyDelete('warehouses')
      toast({ title: 'تم الحذف' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('حذف هذه المادة؟')) return
    try {
      await materialRepository.delete(id)
      dataChangeEmitter.notifyDelete('materials')
      toast({ title: 'تم الحذف' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  // قيمة كل مخزون
  const totalInventoryValue = allMaterials.reduce(
    (s, m) => s + m.quantity * m.unitCost,
    0
  )

  // لو في عرض المعاملات
  if (showTransactions) {
    return (
      <TransactionList
        transactions={allTransactions}
        materials={allMaterials}
        onBack={() => setShowTransactions(false)}
      />
    )
  }

  // لو في عرض تفاصيل مخزن
  if (selectedWarehouse) {
    return (
      <MaterialList
        warehouse={selectedWarehouse}
        materials={selectedMaterials}
        onBack={() => setSelectedWarehouseId(null)}
        onAddMaterial={() => setOpenMaterial(true)}
        onDeleteMaterial={handleDeleteMaterial}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">المخازن</h2>
          <p className="text-xs text-slate-500">إدارة المخازن والمواد وحركاتها</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowTransactions(true)}
            className="border-slate-200 h-9 text-xs font-medium"
            disabled={allTransactions.length === 0}
          >
            <History className="w-4 h-4 ml-1" />
            الحركات
          </Button>
          <Button
            variant="outline"
            onClick={handleSeedDefaults}
            className="border-slate-200 h-9 text-xs font-medium"
          >
            <Sparkles className="w-4 h-4 ml-1" />
            تهيئة
          </Button>
          <Button
            onClick={() => setOpenWarehouse(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-9 text-xs font-medium"
          >
            <Plus className="w-4 h-4 ml-1" />
            مخزن
          </Button>
        </div>
      </div>

      {/* بطاقة إجمالي قيمة المخزون */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-100">إجمالي قيمة المخزون</p>
            <p className="text-2xl font-bold">{formatCurrency(totalInventoryValue)}</p>
            <p className="text-[10px] text-blue-100 mt-1">
              {warehouses.length} مخزن • {allMaterials.length} مادة
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* قائمة المخازن */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <WarehouseIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد مخازن</p>
          <p className="text-xs text-slate-400 mt-1">
            استخدم زر "تهيئة" لإنشاء المخازن الافتراضية
          </p>
          <Button
            onClick={handleSeedDefaults}
            className="mt-3 bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs font-medium"
          >
            <Sparkles className="w-4 h-4 ml-1" />
            تهيئة المخازن الافتراضية
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {warehouses.map((w) => (
            <WarehouseCard
              key={w.id}
              warehouse={w}
              materials={allMaterials}
              onClick={() => setSelectedWarehouseId(w.id)}
            />
          ))}
        </div>
      )}

      <WarehouseForm
        open={openWarehouse}
        onOpenChange={setOpenWarehouse}
        onSaved={() => {
          setOpenWarehouse(false)
          reload()
        }}
      />
      <MaterialForm
        open={openMaterial}
        onOpenChange={setOpenMaterial}
        warehouseId={null}
        warehouses={warehouses}
        onSaved={() => {
          setOpenMaterial(false)
          reload()
        }}
      />
    </div>
  )
}

// ====== نموذج إضافة مخزن (يبقى في الملف الرئيسي) ======
interface WarehouseFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function WarehouseForm({ open, onOpenChange, onSaved }: WarehouseFormProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<Warehouse['type']>('raw_materials')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const reset = () => {
    setName('')
    setType('raw_materials')
    setLocation('')
    setNotes('')
  }

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'أدخل اسم المخزن', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await warehouseRepository.create({
        name: name.trim(),
        type,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      dataChangeEmitter.notifyCreate('warehouses')
      reset()
      onSaved()
      toast({ title: 'تم إنشاء المخزن' })
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
          <DialogTitle className="text-right">مخزن جديد</DialogTitle>
          <DialogDescription className="sr-only">إدارة المخازن والمواد</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">اسم المخزن *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مخزن القماش"
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label className="text-xs">نوع المخزن</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as Warehouse['type'])}
            >
              <SelectTrigger className="bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw_materials">مواد خام</SelectItem>
                <SelectItem value="finished_goods">منتجات منتهية</SelectItem>
                <SelectItem value="general">عام</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">الموقع</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="مثال: الدور الأول"
              className="bg-slate-50"
            />
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
            className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs font-medium"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ المخزن'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
