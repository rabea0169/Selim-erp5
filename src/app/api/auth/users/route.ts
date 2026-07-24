import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasPermission } from '@/lib/permissions'
import { db } from '@/lib/db-server'

// GET /api/auth/users - list users in company
export async function GET() {
  try {
    const auth = await requireAuth('manageUsers')
    if (!auth.authorized) return auth.response

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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/auth/users?id=xxx - delete user
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth('manageUsers')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('id')
    if (!userId) {
      return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    // Can't delete yourself
    if (userId === auth.user.id) {
      return NextResponse.json({ error: 'لا يمكنك حذف حسابك' }, { status: 400 })
    }

    // Only owner can delete other owners/admins
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, companyId: true },
    })

    if (!targetUser || targetUser.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    if ((targetUser.role === 'owner' || targetUser.role === 'admin') && auth.user.role !== 'owner') {
      return NextResponse.json({ error: 'فقط المالك يمكنه حذف المديرين' }, { status: 403 })
    }

    await db.user.delete({ where: { id: userId } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
