import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth } from '@/lib/api'

// POST /api/seed
export const POST = withAuth('create', async ({ auth }) => {
  const defaultCategories = [
    'كهرباء', 'مياه', 'إيجار', 'مرتبات',
    'خامات', 'صيانة', 'نقل ومواصلات', 'مصاريف إدارية', 'أخرى',
  ]

  const results: { name: string; created: boolean }[] = []

  for (const name of defaultCategories) {
    const existing = await db.expenseCategory.findFirst({
      where: withCompanyScope({ name }, auth.companyId),
    })
    if (!existing) {
      await db.expenseCategory.create({
        data: { name, companyId: auth.companyId },
      })
      results.push({ name, created: true })
    } else {
      results.push({ name, created: false })
    }
  }

  const categories = await db.expenseCategory.findMany({
    where: withCompanyScope({}, auth.companyId),
    orderBy: { name: 'asc' },
  })

  const createdCount = results.filter((r) => r.created).length

  return NextResponse.json({
    success: true,
    message: createdCount > 0 ? `تمت تهيئة ${createdCount} بند مصروف جديد` : 'بنود المصاريف موجودة بالفعل',
    categories,
    createdCount,
  })
})
