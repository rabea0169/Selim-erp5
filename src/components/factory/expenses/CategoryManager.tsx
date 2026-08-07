'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { expenseCategoryRepository, dataChangeEmitter } from '@/lib/db'
import type { ExpenseCategory } from './types'

interface CategoryManagerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: ExpenseCategory[]
  onSaved: () => void
}

export function CategoryManager({ open, onOpenChange, categories, onSaved }: CategoryManagerProps) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const addCategory = async () => {
    if (!name.trim()) {
      toast({ title: 'تنبيه', description: 'أدخل اسم البند', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await expenseCategoryRepository.create({ name, notes: notes || undefined })
      dataChangeEmitter.notifyCreate('expenseCategories')
      toast({ title: 'تم', description: 'تمت إضافة البند' })
      setName('')
      setNotes('')
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const deleteCategory = async (id: string, count: number = 0) => {
    if (count > 0) {
      toast({
        title: 'لا يمكن الحذف',
        description: `هذا البند مرتبط بـ ${count} مصروف. احذف المصروفات المرتبطة أولاً.`,
        variant: 'destructive',
      })
      return
    }
    if (!confirm('حذف هذا البند؟')) return
    try {
      await expenseCategoryRepository.delete(id)
      dataChangeEmitter.notifyDelete('expenseCategories')
      dataChangeEmitter.notifyDelete('expenses')
      toast({ title: 'تم الحذف' })
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">إدارة بنود المصاريف</DialogTitle>
          <DialogDescription className="sr-only">إدارة بنود المصاريف</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div>
              <Label className="text-xs">اسم البند الجديد</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white" />
            </div>
            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-white" />
            </div>
            <Button
              onClick={addCategory}
              disabled={saving}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة بند
            </Button>
          </div>

          <div className="space-y-1 max-h-60 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-4">لا توجد بنود</p>
            ) : (
              categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-white border border-slate-100 rounded-lg p-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">{c.name}</p>
                    {c.expenseCount !== undefined && c.expenseCount > 0 && (
                      <p className="text-[10px] text-slate-500">{c.expenseCount} مصروف</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-rose-500"
                    onClick={() => deleteCategory(c.id, c.expenseCount || 0)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
