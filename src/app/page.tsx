'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [factorySettings, setFactorySettings] = useState<FactorySettings | null>(null)
  const [initTrigger, setInitTrigger] = useState(0)
  const initializedRef = useRef<string | null>(null)

  const handleAuthenticated = useCallback(() => {
    initializedRef.current = null
    setUser(getCurrentUser())
    setAuthChecked(true)
    setInitTrigger((t) => t + 1)
  }, [])

  // التحقق من تسجيل الدخول + تحميل بيانات المصنع
  useEffect(() => {
    const currentUser = getCurrentUser()
    setUser(currentUser)
    setAuthChecked(true)

    if (!currentUser) return
    // منع تشغيل التهيئة أكثر من مرة لنفس المستخدم
    if (initializedRef.current === currentUser.id) return
    initializedRef.current = currentUser.id

    let cancelled = false

    Promise.resolve().then(async () => {
      try {
        // فحص سلامة البيانات + استرجاع تلقائي لو فقدت
        const integrity = await checkDataIntegrity()
        if (integrity.lost && !cancelled) {
          console.error(`[App] DATA LOSS DETECTED! had ${integrity.lastKnownCount}, now ${integrity.currentCount} — attempting auto-restore from cache`)
          try {
            const { autoBackupService: abs } = await import('@/lib/db/auto-backup')
            const cachedBackup = await abs.getLastCacheBackup()
            if (cachedBackup?.data) {
              const { reportRepository: rr } = await import('@/lib/db/repositories')
              await rr.importAll(cachedBackup)
              console.log('[App] ✅ Auto-restore from cache backup successful!')
              const restoredStats = await getDBStats()
              const restoredCount = Object.values(restoredStats).reduce((a: number, b: number) => a + Math.max(0, b), 0)
              console.log(`[App] After restore: ${restoredCount} records`)
            }
          } catch (restoreErr) {
            console.error('[App] Auto-restore failed:', restoreErr)
          }
        }

        const stats = await getDBStats()
        const totalRecords = Object.values(stats).reduce((a: number, b: number) => a + Math.max(0, b), 0)
        console.log(`[App] DB stats on login: ${totalRecords} total records`, stats)

        const settings = await factorySettingsRepository.get()
        if (!cancelled) setFactorySettings(settings)
        autoBackupService.start()

        // سحب البيانات من السيرفر عند تسجيل الدخول (مرة واحدة فقط)
        if (!cancelled) {
          syncService.initialPull().then((result) => {
            if (result.success && result.count && result.count > 0) {
              console.log(`[App] ✅ Pulled ${result.count} records from server on login`)
            }
          }).catch(() => {})
        }

        // بدء المزامنة التلقائية بعد السحب الأولي
        if (!cancelled) {
          // تأخير قصير لضمان أن initialPull اشتغل أول
          setTimeout(() => {
            if (!cancelled) syncService.start()
          }, 5000)
        }

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
    })

    return () => {
      cancelled = true
      autoBackupService.stop()
      syncService.stop()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initTrigger])

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
    return <AuthScreen onAuthenticated={handleAuthenticated} />
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
