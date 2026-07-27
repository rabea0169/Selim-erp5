import type { ProductionOrder } from '@/lib/db'

export const STATUS_LABELS: Record<ProductionOrder['status'], string> = {
  draft: 'مسودة',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

export const STATUS_STYLES: Record<ProductionOrder['status'], string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
}

export const DEFAULT_STAGES = ['قص', 'خياطة', 'تشطيب', 'تعبئة']
