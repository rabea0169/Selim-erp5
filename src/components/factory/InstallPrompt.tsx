'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa_install_dismissed'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // أسبوع

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // التحقق إذا التطبيق مثبت بالفعل
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) {
      // تأجيل الـ setState لتجنب التحديث المتزامن
      Promise.resolve().then(() => setInstalled(true))
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)

      // التحقق من آخر رفض للمستخدم
      const dismissed = localStorage.getItem(DISMISS_KEY)
      if (!dismissed || Date.now() - Number(dismissed) > DISMISS_DURATION) {
        setTimeout(() => setShowPrompt(true), 3000) // إظهار بعد 3 ثواني
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setInstalled(true)
      setShowPrompt(false)
      console.log('✅ تم تثبيت التطبيق')
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
    } else {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
    setShowPrompt(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShowPrompt(false)
  }

  // لو مثبت أو مش متاح، ماتعرضش
  if (installed || !showPrompt || !deferredPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-emerald-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm mb-0.5">
              ثبّت التطبيق على جهازك
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              افتح التطبيق بسرعة من الشاشة الرئيسية وبدون متصفح، واعمل offline
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleInstall}
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs"
              >
                <Download className="w-4 h-4 ml-1" />
                تثبيت
              </Button>
              <Button
                onClick={handleDismiss}
                size="sm"
                variant="outline"
                className="h-9 text-xs px-3"
              >
                ليس الآن
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
