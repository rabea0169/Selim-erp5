import crypto from 'crypto'

const SESSION_COOKIE = 'factory_session'
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dev-only-fallback-never-use-in-prod'

export function verifySessionToken(token: string | undefined): { userId: string; username: string; role: string } | null {
  if (!token) return null
  try {
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString())
    const { payload, sig } = tokenData
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex')
    if (sig !== expectedSig) return null
    const data = JSON.parse(payload)
    if (data.expires < Date.now()) return null
    return { userId: data.userId, username: data.username, role: data.role || 'user' }
  } catch {
    return null
  }
}
