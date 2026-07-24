import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// POST /api/seed - إنشاء فئات المصاريف الافتراضية
export async function POST() {
  try {
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
