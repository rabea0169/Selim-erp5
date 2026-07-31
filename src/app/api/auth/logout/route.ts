import { NextResponse } from 'next/server'
import { logoutUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function POST() {
  try {
    await logoutUser()
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
