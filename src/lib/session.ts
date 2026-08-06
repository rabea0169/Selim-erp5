const SESSION_COOKIE = 'factory_session'
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dev-only-fallback-never-use-in-prod'

async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function createSessionToken(
  userId: string,
  username: string,
  role: string = 'user',
  companyId?: string
): Promise<string> {
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000
  const payload = JSON.stringify({ userId, username, role, companyId, expires })
  const signature = await hmacSha256(payload, TOKEN_SECRET)
  const tokenData = JSON.stringify({ payload, sig: signature })
  return Buffer.from(tokenData).toString('base64')
}

export async function verifySessionToken(
  token: string | undefined
): Promise<{ userId: string; username: string; role: string; companyId?: string } | null> {
  if (!token) return null
  try {
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString())
    const { payload, sig } = tokenData
    const expectedSig = await hmacSha256(payload, TOKEN_SECRET)
    if (sig !== expectedSig) return null
    const data = JSON.parse(payload)
    if (data.expires < Date.now()) return null
    return { userId: data.userId, username: data.username, role: data.role || 'user', companyId: data.companyId }
  } catch {
    return null
  }
}
