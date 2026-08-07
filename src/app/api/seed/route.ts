import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { safeError } from '@/lib/safe-error'

// POST /api/seed - إنشاء فئات المصاريف الافتراضية
export async function POST() {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }

    const defaultCategories = [
      'كهرباء',
      'مياه',
      'إيجار',
      'مرتبات',
      'خامات',
      'صيانة',
      'نقل ومواصلات',
      'مصاريف إدارية',
      'أخرى',
    ]

    const results: { name: string; created: boolean }[] = []

    for (const name of defaultCategories) {
      const existing = await db.expenseCategory.findFirst({ where: { name } })
      if (!existing) {
        await db.expenseCategory.create({ data: { name } })
        results.push({ name, created: true })
      } else {
        results.push({ name, created: false })
      }
    }

    const categories = await db.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    })

    const createdCount = results.filter((r) => r.created).length

    return NextResponse.json({
      success: true,
      message:
        createdCount > 0
          ? `تمت تهيئة ${createdCount} بند مصروف جديد`
          : 'بنود المصاريف موجودة بالفعل',
      categories,
      createdCount,
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
