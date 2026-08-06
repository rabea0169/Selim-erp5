'use client'

import { useState, useRef } from 'react'
import { Factory, Database, LogOut, Printer, Search, Bell, Sun, Moon, Wifi, WifiOff, X } from 'lucide-react'
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

interface HeaderProps {
  factoryName: string
  userName: string
  onOpenFactory: () => void
  onOpenPrint: () => void
  onOpenBackup: () => void
  onLogout: () => void
  onNavigate: (tab: TabKey) => void
}

export function Header({
  factoryName,
  userName,
  onOpenFactory,
  onOpenPrint,
  onOpenBackup,
  onLogout,
  onNavigate,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const isOnline = useConnectionStatus()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await globalSearchService.search(q)
        setSearchResults(results)
      } catch (e) {
        console.error('Search error:', e)
      } finally {
        setSearching(false)
      }
    }, 300)
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

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-2xl md:max-w-5xl lg:max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-2">
          {/* Logo + Factory Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-amber-500 text-base font-bold" style={{ fontFamily: 'Georgia, serif' }}>S</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-800 truncate">{factoryName}</h1>
              <p className="text-[10px] text-slate-500 truncate">{userName}</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className={cn(
            'w-2 h-2 rounded-full shrink-0',
            isOnline ? 'bg-emerald-500' : 'bg-rose-500'
          )} title={isOnline ? 'متصل' : 'غير متصل'} aria-label={isOnline ? 'اتصال بالإنترنت متاح' : 'غير متصل بالإنترنت'} />

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

            {/* More menu */}
            <div className="relative group">
              <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10" />
                </svg>
              </button>
              {/* Dropdown */}
              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button
                  onClick={onOpenFactory}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Factory className="w-4 h-4 text-amber-600" />
                  بيانات المصنع
                </button>
                <button
                  onClick={onOpenPrint}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  إعدادات الطباعة
                </button>
                <button
                  onClick={onOpenBackup}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Database className="w-4 h-4 text-slate-600" />
                  نسخ احتياطي
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج
                </button>
              </div>
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
              {!searching && searchResults.map((result) => (
                <button
                  key={result.type + '-' + result.id}
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
