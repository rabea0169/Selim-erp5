import { cookies } from 'next/headers'
import { db } from './db-server'

export interface ServerUser {
  id: string
  username: string
  name: string
  role: string
  phone?: string
  companyId: string
}

export async function getCurrentUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get('session')?.value
    if (!sessionId) return null

    const user = await db.user.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        phone: true,
        companyId: true,
      },
    })

    return user
  } catch {
    return null
  }
}
