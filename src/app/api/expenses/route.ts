import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth, jsonError, notFound } from '@/lib/api'

export const GET = withAuth('read', async ({ auth, req }) => {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const categoryId = searchParams.get('categoryId')
  const q = searchParams.get('q') || ''

  const where: any = withCompanyScope({}, auth.companyId)
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      where.date.lte = toDate
    }
  }
  if (categoryId) where.categoryId = categoryId
  if (q) {
    where.OR = [
      { notes: { contains: q, mode: 'insensitive' } },
      { categoryName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const expenses = await db.expense.findMany({
    where,
    include: { category: true },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ expenses })
})

export const POST = withAuth('create', async ({ auth, req }) => {
  const body = await req.json()
  const { categoryId, amount, date, notes } = body

  if (!categoryId) {
    return jsonError('بند المصروف مطلوب')
  }
  if (!date) {
    return jsonError('التاريخ مطلوب')
  }
  const amt = Number(amount)
  if (isNaN(amt) || amt <= 0) {
    return jsonError('المبلغ يجب أن يكون رقماً موجباً')
  }

  const cat = await db.expenseCategory.findFirst({ where: { id: categoryId, companyId: auth.companyId } })
  if (!cat) {
    return notFound('فئة المصروف غير موجودة')
  }

  const expense = await db.expense.create({
    data: {
      categoryId,
      categoryName: cat.name,
      amount: amt,
      date: new Date(date),
      notes: notes?.trim() || null,
      companyId: auth.companyId,
    },
    include: { category: true },
  })
  return NextResponse.json({ expense })
})
