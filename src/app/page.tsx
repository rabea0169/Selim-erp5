'use client'

import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  FileText,
  Database,
  LogOut,
  Printer,
  Factory,
  Boxes,
  Tags,
  Hammer,
  Coins,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dashboard } from '@/components/factory/Dashboard'
import { SalesView } from '@/components/factory/SalesView'
import { PurchasesView } from '@/components/factory/PurchasesView'
import { WorkersView } from '@/components/factory/WorkersView'
import { ExpensesView } from '@/components/factory/ExpensesView'
import { ReportsView } from '@/components/factory/ReportsView'
import { TreasuryView } from '@/components/factory/TreasuryView'
import { WarehousesView } from '@/components/factory/WarehousesView'
import { ProductsView } from '@/components/factory/ProductsView'
import { ProductionOrdersView } from '@/components/factory/ProductionOrdersView'
import { BackupRestore } from '@/components/factory/BackupRestore'
import { AuthScreen } from '@/components/factory/AuthScreen'
import { PrintSettingsDialog } from '@/components/factory/PrintSettingsDialog'
import { FactorySettingsView } from '@/components/factory/FactorySettingsView'
import { InstallPrompt } from '@/components/factory/InstallPrompt'
import { ConnectionStatus } from '@/components/factory/ConnectionStatus'
import { ThemeToggle } from '@/components/factory/ThemeToggle'
import { GlobalSearch } from '@/components/factory/GlobalSearch'
import { AlertsPanel } from '@/components/factory/AlertsPanel'
import { getCurrentUser, logout, factorySettingsRepository, expenseCategoryRepository, warehouseRepository, autoBackupService, auditLogRepository, type SessionUser, type FactorySettings } from '@/lib/db'

export type TabKey =
  | 'dashboard'
  | 'sales'
  | 'purchases'
  | 'workers'
  | 'expenses'
  | 'reports'
  | 'treasury'
  | 'warehouses'
  | 'products'
  | 'productionOrders'

interface TabDef {
  key: TabKey
  label: string
  icon: any
  group: 'main' | 'ops'
}

const TABS: TabDef[] = [
  { key: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard, group: 'main' },
  { key: 'sales', label: 'المبيعات', icon: ShoppingCart, group: 'main' },
  { key: 'purchases', label: 'المشتريات', icon: Package, group: 'main' },
  { key: 'workers', label: 'الموظفين', icon: Users, group: 'main' },
  { key: 'expenses', label: 'المصاريف', icon: Wallet, group: 'main' },
  { key: 'treasury', label: 'الخزينة', icon: Coins, group: 'ops' },
  { key: 'warehouses', label: 'المخازن', icon: Boxes, group: 'ops' },
  { key: 'products', label: 'منتجات', icon: Tags, group: 'ops' },
  { key: 'productionOrders', label: 'التشغيل', icon: Hammer, group: 'ops' },
  { key: 'reports', label: 'التقارير', icon: FileText, group: 'ops' },
]

export default function Home() {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [backupOpen, setBackupOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [factoryOpen, setFactoryOpen] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [factorySettings, setFactorySettings] = useState<FactorySettings | null>(null)

  // التحقق من تسجيل الدخول + تحميل بيانات المصنع
  useEffect(() => {
    Promise.resolve().then(async () => {
      const currentUser = getCurrentUser()
      setUser(currentUser)
      setAuthChecked(true)
      if (currentUser) {
        try {
          const settings = await factorySettingsRepository.get()
          setFactorySettings(settings)
          // بدء النسخ الاحتياطي التلقائي
          autoBackupService.start()
          // تهيئة المخازن الافتراضية (إن لم تكن موجودة)
          warehouseRepository.seedDefaults().catch((e) => {
            console.error('Failed to seed warehouses:', e)
          })
          // تسجيل دخول في audit log
          auditLogRepository.log({
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'login',
            entityType: 'auth',
            description: `تسجيل دخول: ${currentUser.username}`,
          })
        } catch (e) {
          console.error('Failed to load factory settings:', e)
        }
      }
    })

    // تهيئة فئات المصاريف الافتراضية
    expenseCategoryRepository.seedDefaults().catch((e) => {
      console.error('Failed to seed expense categories:', e)
    })

    // إيقاف النسخ الاحتياطي عند الخروج
    return () => {
      autoBackupService.stop()
    }
  }, [reloadKey])

  const handleLogout = () => {
    if (!confirm('هل تريد تسجيل الخروج؟')) return
    logout()
    setUser(null)
    setTab('dashboard')
  }

  // لو لسه بيتحقق
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
      </div>
    )
  }

  // لو مش مسجل دخول - اعرض شاشة الدخول
  if (!user) {
    return <AuthScreen onAuthenticated={() => setReloadKey((k) => k + 1)} />
  }

  // تقسيم الـ tabs لمجموعتين: رئيسية + عمليات
  const mainTabs = TABS.filter((t) => t.group === 'main')
  const opsTabs = TABS.filter((t) => t.group === 'ops')

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-sm">
              <span className="text-amber-500 text-lg font-bold" style={{ fontFamily: 'Georgia, serif' }}>S</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">
                {factorySettings?.factoryName || 'Selim ERP'}
              </h1>
              <p className="text-[10px] text-slate-500 leading-tight">
                مرحباً، {user.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ConnectionStatus />
            <GlobalSearch onNavigate={(t) => setTab(t as TabKey)} />
            <AlertsPanel onNavigate={(target) => {
              if (target === 'backup') setBackupOpen(true)
              else setTab(target as TabKey)
            }} />
            <ThemeToggle />
            <button
              onClick={() => setFactoryOpen(true)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              title="بيانات المصنع"
            >
              <Factory className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPrintOpen(true)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              title="إعدادات الطباعة"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={() => setBackupOpen(true)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              title="نسخ احتياطي"
            >
              <Database className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-28 pt-4">
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'sales' && <SalesView />}
        {tab === 'purchases' && <PurchasesView />}
        {tab === 'workers' && <WorkersView />}
        {tab === 'expenses' && <ExpensesView />}
        {tab === 'reports' && <ReportsView />}
        {tab === 'treasury' && <TreasuryView />}
        {tab === 'warehouses' && <WarehousesView />}
        {tab === 'products' && <ProductsView />}
        {tab === 'productionOrders' && <ProductionOrdersView />}
      </main>

      {/* Bottom nav - scrollable أفقي */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 shadow-lg">
        <div className="max-w-2xl mx-auto">
          {/* صف التبويبات - scrollable */}
          <div className="flex items-stretch overflow-x-auto no-scrollbar">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex flex-col items-center justify-center py-2 px-3 gap-0.5 transition-colors relative shrink-0 min-w-[68px]',
                    active
                      ? 'text-emerald-600'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-transform',
                      active && 'scale-110'
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-medium whitespace-nowrap',
                      active && 'font-bold'
                    )}
                  >
                    {t.label}
                  </span>
                  {active && (
                    <span className="absolute top-0 w-8 h-0.5 rounded-full bg-emerald-600" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <BackupRestore open={backupOpen} onOpenChange={setBackupOpen} />
      <PrintSettingsDialog open={printOpen} onOpenChange={setPrintOpen} />
      <FactorySettingsView open={factoryOpen} onOpenChange={setFactoryOpen} />
      <InstallPrompt />
    </div>
  )
}
