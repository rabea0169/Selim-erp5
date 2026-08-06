'use client'

import { useState, useEffect } from 'react'
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
import { ReceivablesView } from '@/components/factory/ReceivablesView'
import { ReturnsView } from '@/components/factory/ReturnsView'
import { BackupRestore } from '@/components/factory/BackupRestore'
import { AuthScreen } from '@/components/factory/AuthScreen'
import { PrintSettingsDialog } from '@/components/factory/PrintSettingsDialog'
import { FactorySettingsView } from '@/components/factory/FactorySettingsView'
import { InstallPrompt } from '@/components/factory/InstallPrompt'
import { Header } from '@/components/factory/Header'
import { BottomNav, type TabKey } from '@/components/factory/BottomNav'
import { getCurrentUser, logout, factorySettingsRepository, expenseCategoryRepository, warehouseRepository, autoBackupService, syncService, auditLogRepository, getDBStats, checkDataIntegrity, type SessionUser, type FactorySettings } from '@/lib/db'

export type { TabKey }

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
          // فحص سلامة البيانات + استرجاع تلقائي لو فقدت
          const integrity = await checkDataIntegrity()
          if (integrity.lost) {
            console.error(`[App] DATA LOSS DETECTED! had ${integrity.lastKnownCount}, now ${integrity.currentCount} — attempting auto-restore from cache`)
            try {
              const { autoBackupService } = await import('@/lib/db/auto-backup')
              const cachedBackup = await autoBackupService.getLastCacheBackup()
              if (cachedBackup?.data) {
                const { reportRepository } = await import('@/lib/db/repositories')
                await reportRepository.importAll(cachedBackup)
                console.log('[App] ✅ Auto-restore from cache backup successful!')
                // reload stats after restore
                const restoredStats = await getDBStats()
                const restoredCount = Object.values(restoredStats).reduce((a: number, b: number) => a + Math.max(0, b), 0)
                console.log(`[App] After restore: ${restoredCount} records`)
              } else {
                console.warn('[App] No cache backup available for restore')
              }
            } catch (restoreErr) {
              console.error('[App] Auto-restore failed:', restoreErr)
            }
          }

          const stats = await getDBStats()
          const totalRecords = Object.values(stats).reduce((a: number, b: number) => a + Math.max(0, b), 0)
          console.log(`[App] DB stats on login: ${totalRecords} total records`, stats)

          const settings = await factorySettingsRepository.get()
          setFactorySettings(settings)
          autoBackupService.start()
          // تفعيل المزامنة التلقائية دائماً (مُفعّلة افتراضياً)
          syncService.start()
          // سحب تلقائي للبيانات من السيرفر عند تسجيل الدخول
          syncService.initialPull().then((result) => {
            if (result.success && result.count && result.count > 0) {
              console.log(`[App] ✅ Pulled ${result.count} records from server on login`)
              // إعادة تحميل الإحصائيات بعد السحب
              setReloadKey((k) => k + 1)
            }
          }).catch(() => {})
          warehouseRepository.seedDefaults().catch(() => {})
          expenseCategoryRepository.seedDefaults().catch(() => {})
          auditLogRepository.log({
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'login',
            entityType: 'auth',
            description: `تسجيل دخول: ${currentUser.username}`,
          })
        } catch (e) {
          console.error('[App] Initialization error (non-fatal):', e)
        }
      }
    })

    return () => {
      autoBackupService.stop()
      syncService.stop()
    }
  }, [reloadKey])

  const handleLogout = async () => {
    // TODO: Replace confirm() with a custom confirmation dialog component
    if (!confirm('هل تريد تسجيل الخروج؟')) return
    await logout()
    setUser(null)
    setTab('dashboard')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <AuthScreen onAuthenticated={() => setReloadKey((k) => k + 1)} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <Header
        factoryName={factorySettings?.factoryName || 'Selim ERP'}
        userName={user.name}
        onOpenFactory={() => setFactoryOpen(true)}
        onOpenPrint={() => setPrintOpen(true)}
        onOpenBackup={() => setBackupOpen(true)}
        onLogout={handleLogout}
        onNavigate={setTab}
      />

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 pb-24 pt-4">
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
        {tab === 'receivables' && <ReceivablesView />}
        {tab === 'returns' && <ReturnsView />}
      </main>

      <BottomNav activeTab={tab} onTabChange={setTab} />

      <BackupRestore open={backupOpen} onOpenChange={setBackupOpen} />
      <PrintSettingsDialog open={printOpen} onOpenChange={setPrintOpen} />
      <FactorySettingsView open={factoryOpen} onOpenChange={setFactoryOpen} />
      <InstallPrompt />
    </div>
  )
}
