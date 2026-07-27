'use client'

import { useMemo, type ReactNode } from 'react'
import {
  Package,
  Tag,
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  RotateCcw,
  Factory,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  BarChart3,
  ShoppingCart,
  History,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  saleRepository,
  saleReturnRepository,
  productionOrderRepository,
  useLiveData,
  type Product,
} from '@/lib/db'
import { formatCurrency, formatNumber, formatDate } from '@/lib/format'

interface ProductDetailProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MovementType = 'sale' | 'return' | 'production'

interface InventoryMovement {
  id: string
  date: string
  type: MovementType
  description: string
  reference?: string
  quantityChange: number // سالب للبيع، موجب للمرتجع والإنتاج
}

interface MovementWithBalance extends InventoryMovement {
  runningBalance: number
}

export function ProductDetail({ product: p, open, onOpenChange }: ProductDetailProps) {
  // تحميل كل الحركات بشكل تفاعلي عبر useLiveData
  const { data: movements, loading } = useLiveData<InventoryMovement[]>(
    async () => {
      const [sales, returns, productionOrders] = await Promise.all([
        saleRepository.getByDateRange(),
        saleReturnRepository.getByDateRange(),
        productionOrderRepository.getByProduct(p.id),
      ])

      const list: InventoryMovement[] = []

      // المبيعات → خصم من المخزون
      for (const sale of sales) {
        const matching = sale.items.filter((it) => it.productId === p.id)
        if (matching.length === 0) continue
        const qty = matching.reduce((s, it) => s + it.quantity, 0)
        list.push({
          id: `sale-${sale.id}`,
          date: sale.date,
          type: 'sale',
          description: `بيع إلى ${sale.customerName}`,
          reference: sale.invoiceNo ? `فاتورة ${sale.invoiceNo}` : undefined,
          quantityChange: -qty,
        })
      }

      // مرتجعات المبيعات → إضافة للمخزون
      for (const ret of returns) {
        const matching = ret.items.filter((it) => it.productId === p.id)
        if (matching.length === 0) continue
        const qty = matching.reduce((s, it) => s + it.quantity, 0)
        list.push({
          id: `return-${ret.id}`,
          date: ret.date,
          type: 'return',
          description: `مرتجع من ${ret.customerName}`,
          reference: ret.returnNumber,
          quantityChange: qty,
        })
      }

      // أوامر التشغيل المكتملة → إضافة للمخزون
      for (const order of productionOrders) {
        if (order.status !== 'completed' || !order.completedDate) continue
        if (order.completedQuantity <= 0) continue
        list.push({
          id: `prod-${order.id}`,
          date: order.completedDate,
          type: 'production',
          description: `إنتاج بأمر ${order.orderNumber}`,
          reference: order.productName,
          quantityChange: order.completedQuantity,
        })
      }

      // ترتيب تصاعدي (الأقدم أولاً) لحساب الرصيد الجاري
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      return list
    },
    ['sales', 'saleReturns', 'productionOrders', 'products']
  )

  // حساب الرصيد الجاري (بطرح إجمالي التغييرات من الكمية الحالية)
  const movementsWithBalance: MovementWithBalance[] = useMemo(() => {
    const list = movements || []
    const totalDelta = list.reduce((s, m) => s + m.quantityChange, 0)
    const initialBalance = p.quantity - totalDelta
    let running = initialBalance
    return list.map((m) => {
      running += m.quantityChange
      return { ...m, runningBalance: running }
    })
  }, [movements, p.quantity])

  // ===== الإحصائيات =====
  const costValue = p.quantity * p.cost
  const retailValue = p.quantity * p.retailPrice
  const profitPerUnitRetail = p.retailPrice - p.cost
  const totalPotentialProfit = profitPerUnitRetail * p.quantity
  const profitPctRetail = p.cost > 0 ? (profitPerUnitRetail / p.cost) * 100 : 0

  const profitPerUnitWholesale = p.wholesalePrice - p.cost
  const profitPctWholesale = p.cost > 0 ? (profitPerUnitWholesale / p.cost) * 100 : 0
  const profitPerUnitHalf = p.halfWholesalePrice - p.cost
  const profitPctHalf = p.cost > 0 ? (profitPerUnitHalf / p.cost) * 100 : 0

  const totalSold = movementsWithBalance
    .filter((m) => m.type === 'sale')
    .reduce((s, m) => s + Math.abs(m.quantityChange), 0)
  const totalReturned = movementsWithBalance
    .filter((m) => m.type === 'return')
    .reduce((s, m) => s + m.quantityChange, 0)
  const totalProduced = movementsWithBalance
    .filter((m) => m.type === 'production')
    .reduce((s, m) => s + m.quantityChange, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        {/* رأس متدرج */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-white truncate">
                  {p.name}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  تفاصيل المنتج وحركات المخزون
                </DialogDescription>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {p.category && (
                    <Badge className="text-[10px] bg-white/20 text-white border-white/20 hover:bg-white/30">
                      <Tag className="w-2.5 h-2.5" />
                      {p.category}
                    </Badge>
                  )}
                  <span className="text-[11px] text-indigo-100">
                    الكمية الحالية: {formatNumber(p.quantity)} {p.unit}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-left shrink-0">
              <p className="text-[10px] text-indigo-100">قيمة المخزون</p>
              <p className="text-lg font-bold">{formatCurrency(costValue)}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="stats" className="text-xs">
              <BarChart3 className="w-3.5 h-3.5" />
              إحصائيات
            </TabsTrigger>
            <TabsTrigger value="movements" className="text-xs">
              <History className="w-3.5 h-3.5" />
              حركات المخزون
            </TabsTrigger>
          </TabsList>

          {/* ===== التبويب الأول: الإحصائيات ===== */}
          <TabsContent value="stats" className="space-y-3 mt-3">
            {/* معلومات المنتج */}
            <div className="bg-white rounded-2xl border border-slate-100 p-3">
              <p className="text-[10px] font-bold text-slate-500 mb-2">
                معلومات المنتج
              </p>
              <div className="grid grid-cols-2 gap-2">
                <InfoCell
                  label="الاسم"
                  value={p.name}
                  icon={<Package className="w-3 h-3" />}
                />
                <InfoCell
                  label="الوحدة"
                  value={p.unit}
                  icon={<Package className="w-3 h-3" />}
                />
                <InfoCell
                  label="الفئة"
                  value={p.category || '—'}
                  icon={<Tag className="w-3 h-3" />}
                />
                <InfoCell
                  label="حد إعادة الطلب"
                  value={p.reorderLevel ? formatNumber(p.reorderLevel) : '—'}
                  icon={<Package className="w-3 h-3" />}
                />
              </div>
            </div>

            {/* الأسعار وهوامش الربح */}
            <div className="bg-white rounded-2xl border border-slate-100 p-3">
              <p className="text-[10px] font-bold text-slate-500 mb-2">
                الأسعار وهوامش الربح
              </p>
              <div className="grid grid-cols-3 gap-2">
                <PriceStat
                  label="جملة"
                  price={p.wholesalePrice}
                  profit={profitPerUnitWholesale}
                  profitPct={profitPctWholesale}
                />
                <PriceStat
                  label="نصف جملة"
                  price={p.halfWholesalePrice}
                  profit={profitPerUnitHalf}
                  profitPct={profitPctHalf}
                />
                <PriceStat
                  label="قطاعي"
                  price={p.retailPrice}
                  profit={profitPerUnitRetail}
                  profitPct={profitPctRetail}
                  highlight
                />
              </div>
              <div className="mt-2 bg-rose-50 rounded-lg p-2 flex items-center justify-between">
                <span className="text-[10px] text-rose-700 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  التكلفة للوحدة
                </span>
                <span className="text-sm font-bold text-rose-700">
                  {formatCurrency(p.cost)}
                </span>
              </div>
            </div>

            {/* قيم المخزون */}
            <div className="bg-white rounded-2xl border border-slate-100 p-3">
              <p className="text-[10px] font-bold text-slate-500 mb-2">
                قيم المخزون
              </p>
              <div className="grid grid-cols-2 gap-2">
                <ValueCell
                  label="قيمة التكلفة"
                  value={formatCurrency(costValue)}
                  hint={`${formatNumber(p.quantity)} × ${formatCurrency(p.cost)}`}
                  icon={<Wallet className="w-3.5 h-3.5" />}
                  color="rose"
                />
                <ValueCell
                  label="قيمة البيع (قطاعي)"
                  value={formatCurrency(retailValue)}
                  hint={`${formatNumber(p.quantity)} × ${formatCurrency(p.retailPrice)}`}
                  icon={<DollarSign className="w-3.5 h-3.5" />}
                  color="emerald"
                />
              </div>
              <div className="mt-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  <div>
                    <p className="text-[10px] font-bold text-emerald-800">
                      إجمالي الربح المتوقع
                    </p>
                    <p className="text-[9px] text-emerald-600">
                      {formatCurrency(profitPerUnitRetail)} / وحدة · {profitPctRetail.toFixed(0)}%
                    </p>
                  </div>
                </div>
                <p className="text-base font-bold text-emerald-700">
                  {formatCurrency(totalPotentialProfit)}
                </p>
              </div>
            </div>

            {/* ملخص الحركات */}
            <div className="grid grid-cols-3 gap-2">
              <QuickStat
                label="إجمالي المبيع"
                value={formatNumber(totalSold)}
                hint={p.unit}
                icon={<ShoppingCart className="w-3.5 h-3.5" />}
                color="rose"
              />
              <QuickStat
                label="إجمالي المرتجع"
                value={formatNumber(totalReturned)}
                hint={p.unit}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                color="amber"
              />
              <QuickStat
                label="إجمالي الإنتاج"
                value={formatNumber(totalProduced)}
                hint={p.unit}
                icon={<Factory className="w-3.5 h-3.5" />}
                color="indigo"
              />
            </div>
          </TabsContent>

          {/* ===== التبويب الثاني: حركات المخزون ===== */}
          <TabsContent value="movements" className="mt-3">
            <div className="bg-white rounded-2xl border border-slate-100 p-3">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-slate-200 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : movementsWithBalance.length === 0 ? (
                <div className="text-center py-10">
                  <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    لا توجد حركات مخزون مسجلة
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    ستظهر هنا عمليات البيع والمرتجعات وأوامر التشغيل
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
                          <th className="text-right font-medium py-2 px-1.5">
                            التاريخ
                          </th>
                          <th className="text-right font-medium py-2 px-1.5">
                            النوع
                          </th>
                          <th className="text-right font-medium py-2 px-1.5">
                            البيان
                          </th>
                          <th className="text-center font-medium py-2 px-1.5">
                            التغيّر
                          </th>
                          <th className="text-center font-medium py-2 px-1.5">
                            الرصيد
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {movementsWithBalance
                          .slice()
                          .reverse() // الأحدث أولاً
                          .map((m) => (
                            <MovementRow key={m.id} movement={m} unit={p.unit} />
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2 text-center">
                    الرصيد محسوب من الحركات المسجلة · إجمالي{' '}
                    {formatNumber(movementsWithBalance.length)} حركة
                  </p>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ====== مكوّنات مساعدة ======

function InfoCell({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-2">
      <p className="text-[9px] text-slate-500 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-xs font-bold text-slate-800 truncate">{value}</p>
    </div>
  )
}

function PriceStat({
  label,
  price,
  profit,
  profitPct,
  highlight,
}: {
  label: string
  price: number
  profit: number
  profitPct: number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg p-2 text-center border ${
        highlight
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-slate-50 border-slate-100'
      }`}
    >
      <p
        className={`text-[9px] ${highlight ? 'text-emerald-700' : 'text-slate-500'}`}
      >
        {label}
      </p>
      <p
        className={`text-xs font-bold ${
          highlight ? 'text-emerald-700' : 'text-slate-700'
        }`}
      >
        {formatCurrency(price)}
      </p>
      {profit >= 0 && (
        <p
          className={`text-[9px] ${highlight ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          +{profitPct.toFixed(0)}%
        </p>
      )}
    </div>
  )
}

function ValueCell({
  label,
  value,
  hint,
  icon,
  color,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
  color: 'rose' | 'emerald'
}) {
  const colorMap = {
    rose: 'bg-rose-50 text-rose-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <div className={`${colorMap[color]} rounded-lg p-2.5`}>
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <p className="text-[10px] opacity-80">{label}</p>
      </div>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[9px] opacity-70 mt-0.5">{hint}</p>
    </div>
  )
}

function QuickStat({
  label,
  value,
  hint,
  icon,
  color,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
  color: 'rose' | 'amber' | 'indigo'
}) {
  const colorMap = {
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  }
  return (
    <div className={`rounded-xl border p-2.5 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] opacity-80">{label}</p>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="text-sm font-bold">
        {value} <span className="text-[9px] opacity-70">{hint}</span>
      </p>
    </div>
  )
}

function MovementRow({
  movement,
  unit,
}: {
  movement: MovementWithBalance
  unit: string
}) {
  const typeConfig: Record<
    MovementType,
    { label: string; badgeClass: string; icon: ReactNode }
  > = {
    sale: {
      label: 'بيع',
      badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
      icon: <TrendingDown className="w-3 h-3" />,
    },
    return: {
      label: 'مرتجع',
      badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: <RotateCcw className="w-3 h-3" />,
    },
    production: {
      label: 'إنتاج',
      badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      icon: <Factory className="w-3 h-3" />,
    },
  }
  const cfg = typeConfig[movement.type]
  const isPositive = movement.quantityChange > 0

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="py-2 px-1.5 text-slate-600 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400" />
          {formatDate(movement.date)}
        </div>
      </td>
      <td className="py-2 px-1.5">
        <Badge variant="outline" className={`text-[10px] ${cfg.badgeClass}`}>
          {cfg.icon}
          {cfg.label}
        </Badge>
      </td>
      <td className="py-2 px-1.5 text-slate-700">
        <p className="text-[11px] font-medium">{movement.description}</p>
        {movement.reference && (
          <p className="text-[9px] text-slate-400">{movement.reference}</p>
        )}
      </td>
      <td className="py-2 px-1.5 text-center">
        <span
          className={`inline-flex items-center gap-0.5 font-bold text-[11px] ${
            isPositive ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {isPositive ? (
            <ArrowUpCircle className="w-3 h-3" />
          ) : (
            <ArrowDownCircle className="w-3 h-3" />
          )}
          {isPositive ? '+' : ''}
          {formatNumber(movement.quantityChange)}
        </span>
      </td>
      <td className="py-2 px-1.5 text-center">
        <span className="text-[11px] font-bold text-slate-700">
          {formatNumber(movement.runningBalance)}
        </span>
        <span className="text-[9px] text-slate-400"> {unit}</span>
      </td>
    </tr>
  )
}
