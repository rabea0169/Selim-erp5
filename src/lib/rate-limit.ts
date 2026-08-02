/**
 * In-memory rate limiting for auth endpoints
 * Prevents brute force and user enumeration attacks
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private attempts = new Map<string, RateLimitEntry>()

  constructor(
    private maxAttempts: number,
    private windowMs: number // milliseconds
  ) {}

  check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const entry = this.attempts.get(key)

    // Expired entry, create new one
    if (!entry || entry.resetAt < now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs })
      return { allowed: true, remaining: this.maxAttempts - 1 }
    }

    // Still within window
    entry.count++
    const allowed = entry.count <= this.maxAttempts
    const remaining = Math.max(0, this.maxAttempts - entry.count)

    if (!allowed) {
      console.warn(`[RateLimit] Key "${key}" exceeded limit (${entry.count}/${this.maxAttempts})`)
    }

    return { allowed, remaining }
  }

  reset(key: string): void {
    this.attempts.delete(key)
  }

  // Cleanup old entries every hour to prevent memory leak
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.attempts.entries()) {
      if (entry.resetAt < now - 60 * 60 * 1000) {
        this.attempts.delete(key)
      }
    }
  }
}

// Login rate limiter: 10 attempts per 5 minutes per IP+username
export const loginLimiter = new RateLimiter(10, 5 * 60 * 1000)

// Password recovery rate limiter: 10 attempts per 5 minutes for question lookup
export const passwordRecoveryLookupLimiter = new RateLimiter(10, 5 * 60 * 1000)

// Password reset rate limiter: 5 attempts per 15 minutes for actual reset
export const passwordResetLimiter = new RateLimiter(5, 15 * 60 * 1000)

// Run cleanup periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    loginLimiter.cleanup()
    passwordRecoveryLookupLimiter.cleanup()
    passwordResetLimiter.cleanup()
  }, 60 * 60 * 1000) // Every hour
}
