'use client'

import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Wallet,
  Boxes,
  Tags,
  Hammer,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'

export type TabKey =
  | 'dashboard'
  | 'sales'
  | 'purchases'
  | 'workers'
  | 'reports'
  | 'expenses'
  | 'treasury'
  | 'warehouses'
  | 'products'
  | 'productionOrders'

interface NavItem {
  key: TabKey
  label: string
  shortLabel: string
  icon: any
  color: string
}

// الأقسام الأساسية - تظهر في الـ bottom nav دائماً
const PRIMARY_NAV: NavItem[] = [
  { key: 'dashboard', label: 'الرئيسية', shortLabel: 'الرئيسية', icon: LayoutDashboard, color: 'text-emerald-600' },
  { key: 'sales', label: 'المبيعات', shortLabel: 'مبيعات', icon: ShoppingCart, color: 'text-emerald-600' },
  { key: 'purchases', label: 'المشتريات', shortLabel: 'مشتريات', icon: Package, color: 'text-amber-600' },
  { key: 'workers', label: 'الموظفين', shortLabel: 'موظفين', icon: Users, color: 'text-purple-600' },
  { key: 'reports', label: 'التقارير', shortLabel: 'تقارير', icon: FileText, color: 'text-blue-600' },
]

// الأقسام الإضافية - تظهر في قائمة "المزيد"
const SECONDARY_NAV: NavItem[] = [
  { key: 'treasury', label: 'الخزينة', shortLabel: 'خزينة', icon: Wallet, color: 'text-emerald-600' },
  { key: 'warehouses', label: 'المخازن', shortLabel: 'مخازن', icon: Boxes, color: 'text-indigo-600' },
  { key: 'products', label: 'المنتجات', shortLabel: 'منتجات', icon: Tags, color: 'text-purple-600' },
  { key: 'productionOrders', label: 'أوامر التشغيل', shortLabel: 'تشغيل', icon: Hammer, color: 'text-rose-600' },
  { key: 'expenses', label: 'المصاريف', shortLabel: 'مصاريف', icon: Wallet, color: 'text-rose-600' },
]

interface BottomNavProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // على الموبايل: 4 أساسي + زر "المزيد"
  // على الديسكتوب: كل الأقسام الأساسية + زر "المزيد"
  const visibleItems = isMobile ? PRIMARY_NAV.slice(0, 4) : PRIMARY_NAV

  const handleMoreClick = (key: TabKey) => {
    onTabChange(key)
    setMoreOpen(false)
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-lg">
        {/* Safe area for iPhone */}
        <div className="h-[env(safe-area-inset-bottom)] bg-white" />

        <div className="max-w-2xl mx-auto px-1">
          <div className="grid grid-cols-5 gap-0.5 py-1">
            {visibleItems.map((item) => {
              const Icon = item.icon
              const active = activeTab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => onTabChange(item.key)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg transition-all relative',
                    active ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-xl transition-all',
                    active ? 'bg-emerald-600 scale-110' : 'bg-transparent'
                  )}>
                    <Icon
                      className={cn(
                        'w-4 h-4 sm:w-5 sm:h-5 transition-colors',
                        active ? 'text-white' : 'text-slate-500'
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[9px] sm:text-[10px] font-medium leading-none transition-colors',
                      active ? 'text-emerald-700 font-bold' : 'text-slate-500'
                    )}
                  >
                    {item.shortLabel}
                  </span>
                  {active && (
                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  )}
                </button>
              )
            })}

            {/* زر المزيد */}
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg transition-all relative',
                SECONDARY_NAV.some((i) => i.key === activeTab) ? 'bg-emerald-50' : 'hover:bg-slate-50'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-xl transition-all',
                SECONDARY_NAV.some((i) => i.key === activeTab) ? 'bg-emerald-600 scale-110' : 'bg-slate-100'
              )}>
                <MoreHorizontal
                  className={cn(
                    'w-4 h-4 sm:w-5 sm:h-5 transition-colors',
                    SECONDARY_NAV.some((i) => i.key === activeTab) ? 'text-white' : 'text-slate-500'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[9px] sm:text-[10px] font-medium leading-none',
                  SECONDARY_NAV.some((i) => i.key === activeTab) ? 'text-emerald-700 font-bold' : 'text-slate-500'
                )}
              >
                المزيد
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* قائمة المزيد - Bottom Sheet style */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-md p-0 border-0 rounded-t-3xl rounded-b-none fixed bottom-0 left-0 right-0 translate-y-0 sm:rounded-3xl sm:bottom-1/2 sm:translate-y-1/2" dir="rtl">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>

          <div className="px-4 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">كل الأقسام</h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* الأقسام الإضافية */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {SECONDARY_NAV.map((item) => {
                const Icon = item.icon
                const active = activeTab === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => handleMoreClick(item.key)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border-2',
                      active
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                    )}
                  >
                    <div className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center',
                      active ? 'bg-emerald-600' : 'bg-white shadow-sm'
                    )}>
                      <Icon className={cn('w-5 h-5', active ? 'text-white' : item.color)} />
                    </div>
                    <span className={cn(
                      'text-xs font-medium',
                      active ? 'text-emerald-700 font-bold' : 'text-slate-600'
                    )}>
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* الأقسام الأساسية - للوصول السريع */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-[10px] text-slate-400 mb-2 font-medium">وصول سريع</p>
              <div className="grid grid-cols-5 gap-2">
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon
                  const active = activeTab === item.key
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleMoreClick(item.key)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
                        active ? 'bg-emerald-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', active ? 'text-emerald-600' : 'text-slate-500')} />
                      <span className={cn(
                        'text-[9px] font-medium',
                        active ? 'text-emerald-700 font-bold' : 'text-slate-500'
                      )}>
                        {item.shortLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
