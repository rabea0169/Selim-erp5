import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ====== تهريب النصوص قبل إدراجها في HTML (طباعة/تصدير) ======
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ====== السماح بمصادر صور آمنة فقط (شعار المصنع) ======
export function safeImageSrc(src: unknown): string {
  const value = typeof src === 'string' ? src.trim() : ''
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return value
  if (/^https?:\/\//i.test(value)) return escapeHtml(value)
  return ''
}
