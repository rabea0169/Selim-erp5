'use client'

import { useEffect, useState } from 'react'
import {
  User,
  Lock,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Loader2,
  Factory,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { login, register, hasAnyUser, getRegistrationStatus } from '@/lib/db/auth'

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasUsers, setHasUsers] = useState(true)
  const [serverRegClosed, setServerRegClosed] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    Promise.all([
      hasAnyUser().then(setHasUsers).catch(() => setHasUsers(false)),
      getRegistrationStatus().then((status) => {
        if (status.serverReachable && !status.registrationOpen) {
          setServerRegClosed(true)
          setHasUsers(true)
        }
      }).catch(() => {}),
    ])
      .finally(() => setChecking(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = mode === 'login'
        ? await login(username, password)
        : await register(username, password, name)

      if (!result.success) {
        toast({ title: 'خطأ', description: result.error, variant: 'destructive' })
        return
      }

      const isLocalOnly = serverRegClosed && mode === 'register'
      toast({
        title: mode === 'login' ? 'أهلاً بك' : 'تم التسجيل',
        description:
          mode === 'login'
            ? `مرحباً ${result.user?.name}`
            : isLocalOnly
              ? `تم إنشاء حسابك محلياً، أهلاً ${result.user?.name}`
              : `تم إنشاء حسابك بنجاح، أهلاً ${result.user?.name}`,
      })

      onAuthenticated()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-xl relative">
            <span className="text-amber-500 text-4xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>S</span>
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500"></div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Selim ERP</h1>
          <p className="text-sm text-slate-500 mt-1">نظام إدارة المصنع</p>
          <p className="text-[10px] text-emerald-600 mt-1">💾 يعمل offline - بياناتك محفوظة على جهازك</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 mb-6 bg-slate-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'login'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                if (serverRegClosed) {
                  toast({
                    title: 'تنبيه',
                    description: 'التسجيل مغلق على السيرفر. سيتم إنشاء حساب محلي على هذا الجهاز فقط.',
                  })
                }
                setMode('register')
              }}
              className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'register'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : serverRegClosed
                    ? 'text-amber-600'
                    : 'text-slate-500'
              }`}
            >
              {serverRegClosed ? 'حساب جديد ⚠️' : 'حساب جديد'}
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">الاسم الكامل</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اكتب اسمك الكامل"
                    className="pr-9 bg-slate-50 border-slate-200"
                    required
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">اسم المستخدم</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم المستخدم للدخول"
                  className="pr-9 bg-slate-50 border-slate-200"
                  required
                  autoComplete="username"
                  autoFocus={mode === 'login'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9 pl-9 bg-slate-50 border-slate-200"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white h-12 text-base font-bold shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-5 h-5 ml-2" />
                  دخول
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 ml-2" />
                  إنشاء حساب
                </>
              )}
            </Button>
          </form>

          {/* Info */}
          {mode === 'register' && serverRegClosed && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <p className="font-bold mb-1">⚠️ التسجيل مغلق على السيرفر</p>
              <p>يوجد حساب مدير بالفعل. سيتم إنشاء حسابك محلياً على هذا الجهاز فقط.</p>
              <p className="mt-1">للمزامنة مع السيرفر، سجل دخول بحساب المدير الموجود.</p>
            </div>
          )}

          {mode === 'register' && !serverRegClosed && !hasUsers && (
            <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800">
              <p className="font-bold mb-1">🎉 أول مرة تستخدم فيها النظام؟</p>
              <p>أنشئ حساب المدير الأول. البيانات محفوظة محلياً على جهازك.</p>
            </div>
          )}

          {mode === 'login' && !hasUsers && !serverRegClosed && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
              <p>لا يوجد مستخدمين بعد. أنشئ حساباً جديداً للبدء.</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          نظام إدارة مصنع الملابس - يعمل offline بدون إنترنت
        </p>
      </div>
    </div>
  )
}
