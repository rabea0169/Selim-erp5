// Edge Runtime-compatible session verification using Web Crypto API
// This file is used by middleware (Edge Runtime) where Node.js 'crypto' is not available

const SESSION_EXPIRY_DAYS = 30

function getTokenSecret(): string {
  const secret = process.env.TOKEN_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_SECRET environment variable is required in production')
    }
    return 'dev-only-fallback-never-use-in-prod'
  }
  return secret
}

async function hmacSHA256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message)
  )
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifySessionToken(
  token: string | undefined
): Promise<{ userId: string; username: string; role: string } | null> {
  if (!token) return null
  try {
    const tokenData = JSON.parse(atob(token))
    const { payload, sig } = tokenData
    const expectedSig = await hmacSHA256(getTokenSecret(), payload)
    if (sig !== expectedSig) return null
    const data = JSON.parse(payload)
    if (data.expires < Date.now()) return null
    return { userId: data.userId, username: data.username, role: data.role || 'user' }
  } catch {
    return null
  }
}
