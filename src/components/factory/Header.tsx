'use client'

import { useState } from 'react'
import { Factory, Database, LogOut, Printer, Search, Sun, Moon, Wifi, WifiOff, X, Users, Shield, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { globalSearchService, type SearchResult } from '@/lib/db'
import { useTheme } from '@/lib/use-theme'
import { useConnectionStatus } from '@/lib/use-connection-status'
import { formatCurrency, formatDate } from '@/lib/format'
import type { TabKey } from './BottomNav'

const ROLE_LABELS: Record<string, string> = {
  owner: 'مالك',
  admin: 'مدير',
  manager: 'مشرف',
  employee: 'موظف',
  viewer: 'مشاهد',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-700',
  admin: 'bg-blue-100 text-blue-700',
  manager: 'bg-purple-100 text-purple-700',
  employee: 'bg-emerald-100 text-emerald-700',
  viewer: 'bg-slate-100 text-slate-600',
}

interface HeaderProps {
  factoryName: string
  userName: string
  userRole?: string
  onOpenFactory: () => void
  onOpenPrint: () => void
  onOpenBackup: () => void
  onOpenUsers: () => void
  onLogout: () => void
  onNavigate: (tab: TabKey) => void
  canManageUsers?: boolean
}

export function Header({
  factoryName,
  userName,
  userRole,
  onOpenFactory,
  onOpenPrint,
  onOpenBackup,
  onOpenUsers,
  onLogout,
  onNavigate,
  canManageUsers = false,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const isOnline = useConnectionStatus()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await globalSearchService.search(q)
      setSearchResults(results)
    } catch (e) {
      console.error('Search error:', e)
    } finally {
      setSearching(false)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    const tabMap: Record<string, TabKey> = {
      sale: 'sales',
      purchase: 'purchases',
      worker: 'workers',
      customer: 'sales',
      supplier: 'purchases',
      expense: 'expenses',
    }
    const tab = tabMap[result.type]
    if (tab) onNavigate(tab)
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleLogout = () => {
    setMenuOpen(false)
    if (!confirm('هل تريد تسجيل الخروج؟')) return
    // Call server logout to clear cookie
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    onLogout()
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          {/* Logo + Factory Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-amber-500 text-base font-bold" style={{ fontFamily: 'Georgia, serif' }}>S</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-800 truncate">{factoryName}</h1>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-slate-500 truncate">{userName}</p>
                {userRole && ROLE_LABELS[userRole] && (
                  <span className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded-full font-medium leading-none',
                    ROLE_COLORS[userRole] || 'bg-slate-100 text-slate-600'
                  )}>
                    {ROLE_LABELS[userRole]}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className={cn(
            'w-2 h-2 rounded-full shrink-0',
            isOnline ? 'bg-emerald-500' : 'bg-rose-500'
          )} title={isOnline ? 'متصل' : 'غير متصل'} />

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              title="بحث"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Menu button - tap to open */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                  menuOpen ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                )}
              >
                {menuOpen ? <X className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <>
                  {/* Backdrop for mobile */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                      onClick={() => { setMenuOpen(false); onOpenFactory() }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Factory className="w-4 h-4 text-amber-600" />
                      بيانات المصنع
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onOpenPrint() }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Printer className="w-4 h-4 text-slate-600" />
                      إعدادات الطباعة
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onOpenBackup() }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Database className="w-4 h-4 text-slate-600" />
                      نسخ احتياطي
                    </button>
                    {canManageUsers && (
                      <button
                        onClick={() => { setMenuOpen(false); onOpenUsers() }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Users className="w-4 h-4 text-purple-600" />
                        إدارة المستخدمين
                      </button>
                    )}
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      تسجيل الخروج
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent
          variant="bottom-sheet"
          className="p-0"
          dir="rtl"
        >
          <div className="flex justify-center pt-3 pb-2 sm:hidden">
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>
          <DialogHeader className="px-4 pb-2">
            <DialogTitle className="text-right text-base">البحث الشامل</DialogTitle>
            <DialogDescription className="sr-only">ابحث في كل بيانات التطبيق</DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-4">
            <div className="relative mb-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="ابحث عن فاتورة، موظف، عميل..."
                className="pr-9 bg-slate-50"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto space-y-1">
              {searching && (
                <div className="text-center py-8 text-sm text-slate-400">جارٍ البحث...</div>
              )}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400">لا توجد نتائج</div>
              )}
              {!searching && searchResults.map((result, i) => (
                <button
                  key={i}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-right"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">
                    {result.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{result.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{result.subtitle}</p>
                  </div>
                  {result.amount !== undefined && (
                    <p className="text-xs font-bold text-slate-700 shrink-0">{formatCurrency(result.amount)}</p>
                  )}
                </button>
              ))}
              {!searching && searchQuery.length < 2 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  اكتب حرفين على الأقل للبحث
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
