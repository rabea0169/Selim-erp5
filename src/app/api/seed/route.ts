import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { safeError } from '@/lib/safe-error'

// POST /api/seed - إنشاء فئات المصاريف الافتراضية لشركة المستخدم
export async function POST() {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId ?? null

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
      const existing = await db.expenseCategory.findFirst({ where: { name, companyId } })
      if (!existing) {
        await db.expenseCategory.create({ data: { name, companyId } })
        results.push({ name, created: true })
      } else {
        results.push({ name, created: false })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
