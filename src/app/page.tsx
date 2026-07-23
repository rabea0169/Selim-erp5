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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dashboard } from '@/components/factory/Dashboard'
import { SalesView } from '@/components/factory/SalesView'
import { PurchasesView } from '@/components/factory/PurchasesView'
import { WorkersView } from '@/components/factory/WorkersView'
import { ExpensesView } from '@/components/factory/ExpensesView'
import { ReportsView } from '@/components/factory/ReportsView'
import { BackupRestore } from '@/components/factory/BackupRestore'
import { AuthScreen } from '@/components/factory/AuthScreen'
import { PrintSettingsDialog } from '@/components/factory/PrintSettingsDialog'
import { InstallPrompt } from '@/components/factory/InstallPrompt'

export type TabKey =
  | 'dashboard'
  | 'sales'
  | 'purchases'
  | 'workers'
  | 'expenses'
  | 'reports'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { key: 'sales', label: 'المبيعات', icon: ShoppingCart },
  { key: 'purchases', label: 'المشتريات', icon: Package },
  { key: 'workers', label: 'العمال', icon: Users },
  { key: 'expenses', label: 'المصاريف', icon: Wallet },
  { key: 'reports', label: 'التقارير', icon: FileText },
]

export default function Home() {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [backupOpen, setBackupOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [user, setUser] = useState<{ name: string; username: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // التحقق من تسجيل الدخول
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser({ name: data.user.name, username: data.user.username })
        } else {
          setUser(null)
        }
      })
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))

    // التهيئة الأولية
    fetch('/api/seed', { method: 'POST' }).catch(() => {})
  }, [])

  const handleLogout = async () => {
    if (!confirm('هل تريد تسجيل الخروج؟')) return
    await fetch('/api/auth/logout', { method: 'POST' })
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
    return <AuthScreen onAuthenticated={() => location.reload()} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-lg">👕</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">
                مصنع الملابس
              </h1>
              <p className="text-[10px] text-slate-500 leading-tight">
                مرحباً، {user.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <div className="text-left hidden">
              <p className="text-[10px] text-slate-500">اليوم</p>
              <p className="text-xs font-semibold text-slate-700">
                {new Date().toLocaleDateString('ar-EG', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'sales' && <SalesView />}
        {tab === 'purchases' && <PurchasesView />}
        {tab === 'workers' && <WorkersView />}
        {tab === 'expenses' && <ExpensesView />}
        {tab === 'reports' && <ReportsView />}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 shadow-lg">
        <div className="max-w-2xl mx-auto grid grid-cols-6">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex flex-col items-center justify-center py-2 gap-0.5 transition-colors relative',
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
                    'text-[10px] font-medium',
                    active && 'font-bold'
                  )}
                >
                  {t.label}
                </span>
                {active && (
                  <span className="absolute -mt-2 w-1 h-1 rounded-full bg-emerald-600" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      <BackupRestore open={backupOpen} onOpenChange={setBackupOpen} />
      <PrintSettingsDialog open={printOpen} onOpenChange={setPrintOpen} />
      <InstallPrompt />
    </div>
  )
}
