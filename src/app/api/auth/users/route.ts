import { db } from '@/lib/db-server'
import { NextResponse } from 'next/server'
import { withAuth, jsonError, notFound } from '@/lib/api'

// GET /api/auth/users - list users in company
export const GET = withAuth('manageUsers', async ({ auth }) => {
  const users = await db.user.findMany({
    where: { companyId: auth.companyId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      phone: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ users })
})

// DELETE /api/auth/users?id=xxx - delete user
export const DELETE = withAuth('manageUsers', async ({ auth, req }) => {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('id')
  if (!userId) {
    return jsonError('معرف المستخدم مطلوب')
  }

  // Can't delete yourself
  if (userId === auth.user.id) {
    return jsonError('لا يمكنك حذف حسابك')
  }

  // Only owner can delete other owners/admins
  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, companyId: true },
  })

  if (!targetUser || targetUser.companyId !== auth.companyId) {
    return notFound('المستخدم غير موجود')
  }

  // Protect the company owner from being deleted by non-owners
  if (targetUser.role === 'owner') {
    return jsonError('لا يمكن حذف حساب المالك', 403)
  }

  // Only owner can delete admins
  if (targetUser.role === 'admin' && auth.user.role !== 'owner') {
    return jsonError('فقط المالك يمكنه حذف المديرين', 403)
  }

  await db.user.delete({ where: { id: userId } })
  return NextResponse.json({ success: true })
})
