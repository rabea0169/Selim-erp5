import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyAdmin } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// POST /api/seed - إنشاء فئات المصاريف الافتراضية لشركة الجلسة فقط
export async function POST() {
  try {
    const scope = await requireCompanyAdmin()
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
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
      const existing = await db.expenseCategory.findFirst({
        where: { name, companyId: scope.companyId },
      })

      if (!existing) {
        await db.expenseCategory.create({
          data: { name, companyId: scope.companyId },
        })
        results.push({ name, created: true })
      } else {
        results.push({ name, created: false })
      }
    }

    const categories = await db.expenseCategory.findMany({
      where: { companyId: scope.companyId },
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
