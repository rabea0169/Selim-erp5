'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, UserPlus, Trash2, Shield, Loader2, X, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { getCurrentUser } from '@/lib/db'

const ROLE_LABELS: Record<string, string> = {
  owner: 'مالك',
  admin: 'مدير',
  manager: 'مشرف',
  employee: 'موظف',
  viewer: 'مشاهد',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-700 border-amber-200',
  admin: 'bg-blue-100 text-blue-700 border-blue-200',
  manager: 'bg-purple-100 text-purple-700 border-purple-200',
  employee: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  viewer: 'bg-slate-100 text-slate-600 border-slate-200',
}

const SECURITY_QUESTIONS = [
  'ما هو اسم والدتك؟',
  'ما هي مدينتك المفضلة؟',
  'ما هو اسم مدرستك الابتدائية؟',
  'ما هو اسم حيوانك الأليف الأول؟',
  'ما هي سيارتك المفضلة؟',
]

interface CompanyUser {
  id: string
  username: string
  name: string
  role: string
  phone?: string
  createdAt: string
}

interface UsersManagementProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersManagement({ open, onOpenChange }: UsersManagementProps) {
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const { toast } = useToast()

  // Form state
  const [formUsername, setFormUsername] = useState('')
  const [formName, setFormName] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRole, setFormRole] = useState('employee')
  const [formQuestionIdx, setFormQuestionIdx] = useState(0)
  const [formAnswer, setFormAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/users')
      const data = await res.json()
      if (data.users) setUsers(data.users)
    } catch (e) {
      console.error('Failed to load users:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadUsers()
  }, [open, loadUsers])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formPassword.length < 4) {
      toast({ title: 'خطأ', description: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل', variant: 'destructive' })
      return
    }
    if (!formAnswer.trim()) {
      toast({ title: 'خطأ', description: 'إجابة سؤال الأمان مطلوبة', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername,
          password: formPassword,
          name: formName,
          phone: formPhone,
          role: formRole,
          securityQuestion: SECURITY_QUESTIONS[formQuestionIdx],
          securityAnswer: formAnswer,
        }),
      }).then(r => r.json())

      if (res.error) {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' })
        return
      }

      toast({ title: 'تم بنجاح', description: `تم إضافة المستخدم ${formName}` })
      setAddOpen(false)
      resetForm()
      loadUsers()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    const currentUser = getCurrentUser()
    if (currentUser?.id === userId) {
      toast({ title: 'خطأ', description: 'لا يمكنك حذف حسابك', variant: 'destructive' })
      return
    }
    if (!confirm(`هل تريد حذف المستخدم "${userName}"؟`)) return

    try {
      const res = await fetch(`/api/auth/users?id=${userId}`, { method: 'DELETE' }).then(r => r.json())
      if (res.error) {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'تم بنجاح', description: 'تم حذف المستخدم' })
      loadUsers()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const resetForm = () => {
    setFormUsername('')
    setFormName('')
    setFormPassword('')
    setFormPhone('')
    setFormRole('employee')
    setFormQuestionIdx(0)
    setFormAnswer('')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent variant="bottom-sheet" className="p-0" dir="rtl">
          <div className="flex justify-center pt-3 pb-2 sm:hidden">
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>
          <DialogHeader className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Users className="w-4.5 h-4.5 text-purple-600" />
                </div>
                <div>
                  <DialogTitle className="text-base">إدارة المستخدمين</DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-500">
                    {users.length} مستخدم مسجل
                  </DialogDescription>
                </div>
              </div>
              <Button
                onClick={() => { resetForm(); setAddOpen(true) }}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                إضافة
              </Button>
            </div>
          </DialogHeader>

          <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا يوجد مستخدمين</p>
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                        <span className={
                          'text-[9px] px-1.5 py-0.5 rounded-full font-medium border ' +
                          (ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600 border-slate-200')
                        }>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">@{u.username}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent variant="bottom-sheet" className="p-0" dir="rtl">
          <div className="flex justify-center pt-3 pb-2 sm:hidden">
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>
          <DialogHeader className="px-4 pb-2">
            <DialogTitle className="text-base">إضافة مستخدم جديد</DialogTitle>
            <DialogDescription className="text-[11px] text-slate-500">
              أضف مستخدم لشركتك
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddUser} className="px-4 pb-6 space-y-3">
            <div>
              <Label className="text-xs mb-1">اسم المستخدم *</Label>
              <Input
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                placeholder="مثال: ahmed"
                required
                minLength={3}
              />
            </div>
            <div>
              <Label className="text-xs mb-1">الاسم الكامل *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثال: أحمد محمد"
                required
              />
            </div>
            <div>
              <Label className="text-xs mb-1">كلمة المرور *</Label>
              <Input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="4 أحرف على الأقل"
                required
                minLength={4}
              />
            </div>
            <div>
              <Label className="text-xs mb-1">رقم الهاتف</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="اختياري"
              />
            </div>
            <div>
              <Label className="text-xs mb-1">الدور *</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(['admin', 'manager', 'employee', 'viewer'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setFormRole(role)}
                    className={`
                      px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all
                      ${formRole === role
                        ? (ROLE_COLORS[role] || '') + ' ring-2 ring-offset-1 ring-purple-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }
                    `}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1">سؤال الأمان *</Label>
              <select
                value={formQuestionIdx}
                onChange={(e) => setFormQuestionIdx(Number(e.target.value))}
                className="w-full mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                {SECURITY_QUESTIONS.map((q, i) => (
                  <option key={i} value={i}>{q}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1">إجابة سؤال الأمان *</Label>
              <Input
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
                placeholder="الإجابة التي سيتم استخدامها لاسترجاع كلمة المرور"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              إضافة المستخدم
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
