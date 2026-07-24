import { NextResponse } from 'next/server'
import { logoutUser } from '@/lib/auth'

export async function POST() {
  try {
    await logoutUser()
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
