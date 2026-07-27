import type { Warehouse } from '@/lib/db'

export const WAREHOUSE_TYPE_LABELS: Record<Warehouse['type'], string> = {
  raw_materials: 'مواد خام',
  finished_goods: 'منتجات منتهية',
  general: 'عام',
}

// ألوان ثابتة لكل نوع (لتجنب dynamic classes في tailwind)
export const WAREHOUSE_TYPE_STYLES: Record<
  Warehouse['type'],
  {
    iconBg: string
    iconText: string
    badgeBg: string
    badgeText: string
    badgeBorder: string
    headerGradient: string
  }
> = {
  raw_materials: {
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    headerGradient: 'from-amber-500 to-orange-600',
  },
  finished_goods: {
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    headerGradient: 'from-emerald-500 to-teal-600',
  },
  general: {
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    headerGradient: 'from-blue-500 to-indigo-600',
  },
}
