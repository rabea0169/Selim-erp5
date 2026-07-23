import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    // إنشاء فئات مصاريف افتراضية
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

    for (const name of defaultCategories) {
      const exists = await db.expenseCategory.findFirst({ where: { name } })
      if (!exists) {
        await db.expenseCategory.create({ data: { name } })
      }
    }

    const categories = await db.expenseCategory.findMany()

    return NextResponse.json({
      success: true,
      message: 'تمت تهيئة البيانات الأولية',
      categories,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
