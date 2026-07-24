'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Lock,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Loader2,
  Building2,
  Phone,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { login, register, hasAnyUser } from '@/lib/db'

const SECURITY_QUESTIONS = [
  'ما هو اسم والدتك؟',
  'ما هي مدينتك المفضلة؟',
  'ما هو اسم مدرستك الابتدائية؟',
  'ما هو اسم حيوانك الأليف الأول؟',
  'ما هي سيارتك المفضلة؟',
]

type AuthMode = 'login' | 'register' | 'forgot-password' | 'verify-question' | 'reset-password'

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasUsers, setHasUsers] = useState(true)
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    hasAnyUser()
      .then(setHasUsers)
      .catch((e) => console.error('Failed to check users:', e))
      .finally(() => setChecking(false))
  }, [])

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await login(username, password)
      if (!result.success) {
        toast({ title: 'خطأ', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'أهلاً بك', description: `مرحباً ${result.user?.name}` })
      onAuthenticated()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [username, password, onAuthenticated, toast])

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast({ title: 'خطأ', description: 'كلمة المرور غير متطابقة', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const result = await register(
        username,
        password,
        name,
        companyName,
        phone,
        SECURITY_QUESTIONS[selectedQuestionIndex],
        securityAnswer,
      )
      if (!result.success) {
        toast({ title: 'خطأ', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم التسجيل', description: `مرحباً ${result.user?.name}` })
      onAuthenticated()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [username, password, confirmPassword, name, companyName, phone, selectedQuestionIndex, securityAnswer, onAuthenticated, toast])

  const handleGetSecurityQuestion = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/forgot-password?username=${encodeURIComponent(username)}`)
      const data = await res.json()
      if (data.error) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' })
        return
      }
      setSecurityQuestion(data.question)
      setMode('verify-question')
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [username, toast])

  const handleResetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmNewPassword) {
      toast({ title: 'خطأ', description: 'كلمة المرور غير متطابقة', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, answer: securityAnswer, newPassword }),
      })
      const data = await res.json()
      if (data.error) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم بنجاح', description: 'تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.' })
      setMode('login')
      setPassword('')
      setSecurityAnswer('')
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [username, securityAnswer, newPassword, confirmNewPassword, toast])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  const goBack = () => {
    if (mode === 'verify-question' || mode === 'reset-password') {
      setMode('forgot-password')
    } else {
      setMode('login')
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900" dir="rtl">
      {/* Left Panel - Branding (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 to-teal-600/20" />
        <div className="absolute top-20 right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-md"
        >
          {/* Logo */}
          <div className="w-28 h-28 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 relative">
            <span className="text-white text-6xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>S</span>
            <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
          </div>

          <h1 className="text-4xl font-bold text-white mb-3">Selim ERP</h1>
          <p className="text-lg text-emerald-200/80 mb-2">نظام إدارة المصنع المتكامل</p>
          <p className="text-sm text-slate-400">إدارة المبيعات، المشتريات، الموظفين، المخازن والمزيد</p>

          <div className="mt-10 space-y-3">
            {[
              'إدارة مبيعات ومشتريات',
              'تتبع الموظفين والحضور',
              'إدارة المخازن والمواد',
              'تقارير وإحصائيات شاملة',
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3 text-slate-300"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-sm">{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center mb-6 lg:hidden"
          >
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-xl relative">
              <span className="text-white text-3xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>S</span>
            </div>
            <h1 className="text-xl font-bold text-white">Selim ERP</h1>
            <p className="text-xs text-slate-400 mt-1">نظام إدارة المصنع</p>
          </motion.div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/[0.07] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8"
          >
            {/* Back Button */}
            {mode !== 'login' && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                رجوع
              </button>
            )}

            <AnimatePresence mode="wait">
              {/* ===== LOGIN ===== */}
              {mode === 'login' && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-white">تسجيل الدخول</h2>
                    <p className="text-sm text-slate-400 mt-1">أدخل بياناتك للوصول إلى النظام</p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">اسم المستخدم</Label>
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="اسم المستخدم"
                          className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">كلمة المرور</Label>
                      <div className="relative">
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pr-9 pl-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white h-11 text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 ml-2" />
                          دخول
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setMode('forgot-password')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>

                  {hasUsers && (
                    <div className="mt-4 pt-4 border-t border-white/5 text-center">
                      <p className="text-sm text-slate-400">
                        ليس لديك حساب؟{' '}
                        <button
                          type="button"
                          onClick={() => setMode('register')}
                          className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                        >
                          أنشئ حساباً
                        </button>
                      </p>
                    </div>
                  )}

                  {!hasUsers && (
                    <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 text-center">
                      <p className="font-bold mb-1">🎉 أول مرة تستخدم فيها النظام؟</p>
                      <p>
                        أنشئ حساب المدير الأول.{' '}
                        <button
                          type="button"
                          onClick={() => setMode('register')}
                          className="text-emerald-400 hover:text-emerald-300 font-medium underline"
                        >
                          ابدأ الآن
                        </button>
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ===== REGISTER ===== */}
              {mode === 'register' && (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-white">
                      {!hasUsers ? 'إنشاء حساب المدير' : 'إنشاء حساب جديد'}
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">أدخل بياناتك لإنشاء حساب</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                    {/* Company Name (only for first user) */}
                    {!hasUsers && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-300">
                          <Building2 className="w-3 h-3 inline ml-1" />
                          اسم الشركة
                        </Label>
                        <div className="relative">
                          <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <Input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="اسم الشركة أو المصنع"
                            className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                            required
                            autoFocus
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">الاسم الكامل</Label>
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="اكتب اسمك الكامل"
                          className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          autoFocus={hasUsers}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">رقم الهاتف</Label>
                      <div className="relative">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="رقم الهاتف (اختياري)"
                          className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">اسم المستخدم</Label>
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="اسم المستخدم للدخول"
                          className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          dir="ltr"
                          autoComplete="username"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">كلمة المرور</Label>
                      <div className="relative">
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pr-9 pl-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          dir="ltr"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">تأكيد كلمة المرور</Label>
                      <div className="relative">
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          dir="ltr"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">
                        <ShieldCheck className="w-3 h-3 inline ml-1" />
                        سؤال الأمان
                      </Label>
                      <div className="relative">
                        <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <select
                          value={selectedQuestionIndex}
                          onChange={(e) => setSelectedQuestionIndex(Number(e.target.value))}
                          className="w-full h-10 pr-9 pl-3 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm focus:border-emerald-500/50 focus:ring-emerald-500/20 appearance-none cursor-pointer"
                        >
                          {SECURITY_QUESTIONS.map((q, i) => (
                            <option key={i} value={i} className="bg-slate-800 text-white">
                              {q}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">إجابة سؤال الأمان</Label>
                      <div className="relative">
                        <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="text"
                          value={securityAnswer}
                          onChange={(e) => setSecurityAnswer(e.target.value)}
                          placeholder="أدخل إجابتك"
                          className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white h-11 text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 ml-2" />
                          {!hasUsers ? 'إنشاء الشركة والحساب' : 'إنشاء حساب'}
                        </>
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* ===== FORGOT PASSWORD - Step 1 ===== */}
              {mode === 'forgot-password' && (
                <motion.div
                  key="forgot-password"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <KeyRound className="w-6 h-6 text-amber-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">نسيت كلمة المرور؟</h2>
                    <p className="text-sm text-slate-400 mt-1">أدخل اسم المستخدم للتحقق من هويتك</p>
                  </div>

                  <form onSubmit={handleGetSecurityQuestion} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">اسم المستخدم</Label>
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="اسم المستخدم"
                          className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          autoFocus
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white h-11 text-sm font-bold shadow-lg shadow-amber-500/25 transition-all"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 ml-2" />
                          التالي
                        </>
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* ===== FORGOT PASSWORD - Step 2: Verify Question ===== */}
              {mode === 'verify-question' && (
                <motion.div
                  key="verify-question"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-amber-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">تحقق من هويتك</h2>
                    <p className="text-sm text-slate-400 mt-1">أجب عن سؤال الأمان</p>
                  </div>

                  <div className="bg-white/[0.06] rounded-xl p-4 mb-4 border border-white/5">
                    <p className="text-sm text-emerald-300 font-medium">{securityQuestion}</p>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault()
                    setMode('reset-password')
                  }} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">إجابتك</Label>
                      <div className="relative">
                        <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="text"
                          value={securityAnswer}
                          onChange={(e) => setSecurityAnswer(e.target.value)}
                          placeholder="أدخل إجابتك"
                          className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={!securityAnswer.trim()}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white h-11 text-sm font-bold shadow-lg shadow-amber-500/25 transition-all"
                    >
                      <ShieldCheck className="w-4 h-4 ml-2" />
                      متابعة
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* ===== FORGOT PASSWORD - Step 3: New Password ===== */}
              {mode === 'reset-password' && (
                <motion.div
                  key="reset-password"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">كلمة المرور الجديدة</h2>
                    <p className="text-sm text-slate-400 mt-1">أدخل كلمة المرور الجديدة</p>
                  </div>

                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">كلمة المرور الجديدة</Label>
                      <div className="relative">
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pr-9 pl-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          dir="ltr"
                          autoFocus
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">تأكيد كلمة المرور</Label>
                      <div className="relative">
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pr-9 bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                          required
                          dir="ltr"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white h-11 text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Lock className="w-4 h-4 ml-2" />
                          تغيير كلمة المرور
                        </>
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer */}
          <p className="text-center text-[11px] text-slate-500 mt-6">
            نظام إدارة مصنع الملابز - Selim ERP
          </p>
        </div>
      </div>
    </div>
  )
}
