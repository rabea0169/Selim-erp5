/**
 * HTML escaping utilities for preventing XSS in print/export
 */

export function escapeHtml(text: string | undefined | null): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Safely escape image src attribute
 * Allowlists: data:image/*, http(s)://, and relative paths
 */
export function safeImageSrc(src: string | undefined | null): string {
  if (!src) return ''
  const trimmed = String(src).trim()
  
  // Allow data URLs for base64 images
  if (trimmed.startsWith('data:image/')) {
    const allowedTypes = ['png', 'jpeg', 'jpg', 'gif', 'webp']
    if (allowedTypes.some(t => trimmed.includes(t))) {
      return trimmed
    }
  }
  
  // Allow http(s) URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      new URL(trimmed) // Validate it's a proper URL
      return escapeHtml(trimmed)
    } catch {
      return ''
    }
  }
  
  // Allow relative paths
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
    return escapeHtml(trimmed)
  }
  
  // Reject everything else (potential XSS)
  console.warn('[Security] Rejected suspicious image src:', trimmed.slice(0, 50))
  return ''
}
