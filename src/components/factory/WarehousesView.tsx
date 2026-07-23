'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Package,
  PackageOpen,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  X,
  Warehouse as WarehouseIcon,
  Sparkles,
  ChevronLeft,
  History,
  Layers,
  MapPin,
  TrendingUp,
  TrendingDown,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { formatCurrency, formatDate, todayStr } from '@/lib/format'
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

const WAREHOUSE_TYPE_LABELS: Record<Warehouse['type'], string> = {
  raw_materials: 'مواد خام',
  finished_goods: 'منتجات منتهية',
  general: 'عام',
}

// ألوان ثابتة لكل نوع (لتجنب dynamic classes في tailwind)
const WAREHOUSE_TYPE_STYLES: Record<
  Warehouse['type'],
  {
    iconBg: string
    iconText: string
    badgeBg: string
    badgeText: string
    badgeBorder: string
    headerGradient: string
  }
> = {
  raw_materials: {
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    headerGradient: 'from-amber-500 to-orange-600',
  },
  finished_goods: {
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    headerGradient: 'from-emerald-500 to-teal-600',
  },
  general: {
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    headerGradient: 'from-blue-500 to-indigo-600',
  },
}

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
      <MaterialTransactionsView
        transactions={allTransactions}
        materials={allMaterials}
        onBack={() => setShowTransactions(false)}
      />
    )
  }

  // لو في عرض تفاصيل مخزن
  if (selectedWarehouse) {
    return (
      <WarehouseDetailView
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
          {warehouses.map((w) => {
            const wMaterials = allMaterials.filter((m) => m.warehouseId === w.id)
            const wValue = wMaterials.reduce(
              (s, m) => s + m.quantity * m.unitCost,
              0
            )
            const style = WAREHOUSE_TYPE_STYLES[w.type]
            return (
              <button
                key={w.id}
                onClick={() => setSelectedWarehouseId(w.id)}
                className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-all text-right"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-9 h-9 rounded-xl ${style.iconBg} flex items-center justify-center`}
                      >
                        {w.type === 'raw_materials' ? (
                          <Package className={`w-5 h-5 ${style.iconText}`} />
                        ) : w.type === 'finished_goods' ? (
                          <PackageOpen className={`w-5 h-5 ${style.iconText}`} />
                        ) : (
                          <Boxes className={`w-5 h-5 ${style.iconText}`} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{w.name}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                        >
                          {WAREHOUSE_TYPE_LABELS[w.type]}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="text-slate-400">عدد المواد</p>
                        <p className="font-bold text-slate-700">
                          {wMaterials.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">قيمة المخزون</p>
                        <p className="font-bold text-emerald-700">
                          {formatCurrency(wValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">الموقع</p>
                        <p className="font-bold text-slate-700 truncate">
                          {w.location || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            )
          })}
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

// ====== تفاصيل مخزن ======
interface WarehouseDetailProps {
  warehouse: Warehouse
  materials: Material[]
  onBack: () => void
  onAddMaterial: () => void
  onDeleteMaterial: (id: string) => void
}

function WarehouseDetailView({
  warehouse,
  materials,
  onBack,
  onAddMaterial,
  onDeleteMaterial,
}: WarehouseDetailProps) {
  const [search, setSearch] = useState('')
  const [addStockFor, setAddStockFor] = useState<Material | null>(null)
  const [consumeStockFor, setConsumeStockFor] = useState<Material | null>(null)

  const filtered = materials.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase())
  )
  const totalValue = materials.reduce((s, m) => s + m.quantity * m.unitCost, 0)
  const style = WAREHOUSE_TYPE_STYLES[warehouse.type]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-4 h-4 rotate-180" />
          رجوع للمخازن
        </button>
        <Button
          onClick={onAddMaterial}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 text-xs font-medium"
        >
          <Plus className="w-4 h-4 ml-1" />
          مادة جديدة
        </Button>
      </div>

      {/* رأس تفاصيل المخزن */}
      <div className={`bg-gradient-to-br ${style.headerGradient} text-white rounded-2xl p-4 shadow-md`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/80">{WAREHOUSE_TYPE_LABELS[warehouse.type]}</p>
            <p className="text-xl font-bold">{warehouse.name}</p>
            {warehouse.location && (
              <p className="text-[10px] text-white/80 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {warehouse.location}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/80">قيمة المخزون</p>
            <p className="text-lg font-bold">{formatCurrency(totalValue)}</p>
            <p className="text-[10px] text-white/80">{materials.length} مادة</p>
          </div>
        </div>
      </div>

      {/* بحث */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث باسم المادة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {/* قائمة المواد */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {search ? 'لا نتائج للبحث' : 'لا توجد مواد في هذا المخزن'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const value = m.quantity * m.unitCost
            const isLowStock = m.reorderLevel && m.quantity <= m.reorderLevel
            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{m.name}</p>
                      {isLowStock && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                          منخفض
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      التكلفة: {formatCurrency(m.unitCost)} / {m.unit}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-slate-400 hover:text-rose-500"
                    onClick={() => onDeleteMaterial(m.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">الكمية المتاحة</p>
                    <p className="text-sm font-bold text-slate-800">
                      {m.quantity} <span className="text-xs text-slate-500">{m.unit}</span>
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <p className="text-[10px] text-emerald-600">القيمة الإجمالية</p>
                    <p className="text-sm font-bold text-emerald-700">
                      {formatCurrency(value)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddStockFor(m)}
                    className="h-8 text-xs font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 ml-1" />
                    إضافة كمية
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConsumeStockFor(m)}
                    className="h-8 text-xs font-medium border-rose-200 text-rose-700 hover:bg-rose-50"
                    disabled={m.quantity <= 0}
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 ml-1" />
                    سحب كمية
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* نماذج إضافة/سحب كمية */}
      {addStockFor && (
        <StockMovementForm
          open={true}
          onOpenChange={(v) => !v && setAddStockFor(null)}
          material={addStockFor}
          mode="add"
          onSaved={() => setAddStockFor(null)}
        />
      )}
      {consumeStockFor && (
        <StockMovementForm
          open={true}
          onOpenChange={(v) => !v && setConsumeStockFor(null)}
          material={consumeStockFor}
          mode="consume"
          onSaved={() => setConsumeStockFor(null)}
        />
      )}
    </div>
  )
}

// ====== نموذج إضافة مخزن ======
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

// ====== نموذج إضافة مادة ======
interface MaterialFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  warehouseId: string | null
  warehouses: Warehouse[]
  onSaved: () => void
}

function MaterialForm({
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

// ====== نموذج إضافة/سحب كمية ======
interface StockMovementProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  material: Material
  mode: 'add' | 'consume'
  onSaved: () => void
}

function StockMovementForm({
  open,
  onOpenChange,
  material,
  mode,
  onSaved,
}: StockMovementProps) {
  const isAdd = mode === 'add'
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [reason, setReason] = useState(isAdd ? 'شراء' : 'استهلاك')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // reset عند فتح النموذج
  useEffect(() => {
    if (open) {
      setQuantity('')
      setUnitCost(String(material.unitCost || ''))
      setReason(isAdd ? 'شراء' : 'استهلاك')
      setNotes('')
    }
  }, [open, material.id, isAdd])

  const save = async () => {
    const num = Number(quantity)
    if (!num || num <= 0) {
      toast({ title: 'أدخل كمية صحيحة', variant: 'destructive' })
      return
    }
    if (isAdd && (!unitCost || Number(unitCost) < 0)) {
      toast({ title: 'أدخل تكلفة الوحدة', variant: 'destructive' })
      return
    }
    if (!isAdd && num > material.quantity) {
      toast({
        title: 'الكمية المطلوبة أكبر من المتاح',
        description: `المتاح: ${material.quantity} ${material.unit}`,
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      if (isAdd) {
        await materialRepository.addStock(
          material.id,
          num,
          Number(unitCost) || 0,
          reason,
          notes.trim() || undefined
        )
        dataChangeEmitter.notifyCreate('materialTransactions')
        dataChangeEmitter.notifyUpdate('materials')
      } else {
        await materialRepository.consumeStock(
          material.id,
          num,
          reason,
          undefined,
          undefined,
          notes.trim() || undefined
        )
        dataChangeEmitter.notifyCreate('materialTransactions')
        dataChangeEmitter.notifyUpdate('materials')
      }
      toast({
        title: isAdd ? 'تم إضافة الكمية' : 'تم سحب الكمية',
        description: `${num} ${material.unit}`,
      })
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
          <DialogTitle className="text-right flex items-center gap-2">
            {isAdd ? (
              <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
            ) : (
              <ArrowUpFromLine className="w-5 h-5 text-rose-600" />
            )}
            {isAdd ? 'إضافة كمية' : 'سحب كمية'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">{material.name}</p>
              <p className="text-[11px] text-slate-500">
                الكمية الحالية: {material.quantity} {material.unit}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">التكلفة</p>
              <p className="text-xs font-bold text-slate-700">
                {formatCurrency(material.unitCost)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">الكمية *</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className={`bg-slate-50 font-bold ${
                  isAdd ? 'text-emerald-700' : 'text-rose-700'
                }`}
              />
            </div>
            {isAdd && (
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
            )}
          </div>

          <div>
            <Label className="text-xs">السبب</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isAdd ? (
                  <>
                    <SelectItem value="شراء">شراء</SelectItem>
                    <SelectItem value="مرتجع">مرتجع</SelectItem>
                    <SelectItem value="تحويل">تحويل من مخزن</SelectItem>
                    <SelectItem value="تسوية">تسوية جرد</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="استهلاك">استهلاك</SelectItem>
                    <SelectItem value="إنتاج">صرف للإنتاج</SelectItem>
                    <SelectItem value="مرتجع للعميل">مرتجع للعميل</SelectItem>
                    <SelectItem value="تالف">تالف</SelectItem>
                    <SelectItem value="تحويل">تحويل لمخزن</SelectItem>
                    <SelectItem value="تسوية">تسوية جرد</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </>
                )}
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
            className={`text-white h-9 text-xs font-medium ${
              isAdd
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {saving ? 'جارٍ الحفظ...' : isAdd ? 'إضافة' : 'سحب'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ====== عرض حركات المواد ======
interface TransactionsViewProps {
  transactions: MaterialTransaction[]
  materials: Material[]
  onBack: () => void
}

function MaterialTransactionsView({
  transactions,
  materials,
  onBack,
}: TransactionsViewProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const materialMap = new Map(materials.map((m) => [m.id, m]))

  const filtered = transactions.filter((t) => {
    const mat = materialMap.get(t.materialId)
    const matName = mat?.name || '—'
    const matchesSearch =
      !search ||
      matName.toLowerCase().includes(search.toLowerCase()) ||
      t.reason.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || t.type === typeFilter
    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-4 h-4 rotate-180" />
          رجوع للمخازن
        </button>
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-1">
          <History className="w-4 h-4" />
          حركات المواد
        </h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث باسم المادة أو السبب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="bg-slate-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحركات</SelectItem>
            <SelectItem value="in">وارد</SelectItem>
            <SelectItem value="out">منصرف</SelectItem>
            <SelectItem value="transfer">تحويل</SelectItem>
            <SelectItem value="adjustment">تسوية</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد حركات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 200).map((t) => {
            const mat = materialMap.get(t.materialId)
            const isIn = t.type === 'in'
            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isIn ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {mat?.name || 'مادة محذوفة'}
                    </p>
                    <span
                      className={`text-xs font-bold ${
                        isIn ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isIn ? '+' : '-'}
                      {t.quantity} {mat?.unit || ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 pr-9">
                    <Calendar className="w-3 h-3" />
                    {formatDate(t.date)}
                    <Badge variant="outline" className="text-[10px] bg-slate-50">
                      {t.reason}
                    </Badge>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length > 200 && (
            <p className="text-center text-[11px] text-slate-400 py-2">
              عرض أول 200 حركة من {filtered.length}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
