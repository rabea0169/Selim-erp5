'use client'

import { ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

interface ResponsiveLayoutProps {
  sidebar: ReactNode
  children: ReactNode
}

/**
 * تخطيط responsive مع شريط جانبي قابل للإغلاق على الهاتف
 */
export function ResponsiveLayout({ sidebar, children }: ResponsiveLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* شريط جانبي - مخفي على الهاتف */}
      <aside className="hidden lg:block w-64 bg-white border-l border-gray-200 overflow-y-auto">
        {sidebar}
      </aside>

      {/* شريط جانبي منزلق على الهاتف */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-screen w-64 bg-white border-l border-gray-200 overflow-y-auto transform transition-transform duration-300 z-50 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* رأس الصفحة */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between lg:hidden">
          <h1 className="text-lg font-semibold text-gray-900">Selim ERP</h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </header>

        {/* المحتوى */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
