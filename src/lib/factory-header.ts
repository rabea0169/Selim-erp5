'use client'

import { factorySettingsRepository } from '@/lib/db'
import { escapeHtml, safeImageSrc } from '@/lib/utils'
import type { FactorySettings } from '@/lib/db/types'

let cachedSettings: FactorySettings | null = null

export async function getFactorySettings(): Promise<FactorySettings> {
  if (cachedSettings) return cachedSettings
  cachedSettings = await factorySettingsRepository.get()
  return cachedSettings
}

export function clearSettingsCache() {
  cachedSettings = null
}

/**
 * توليد HTML لترويسة المصنع في الفواتير والمطبوعات
 */
export function buildFactoryHeader(settings: FactorySettings): string {
  return `
    <div style="text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #0f172a;">
      ${safeImageSrc(settings.logo)
        ? `<img src="${safeImageSrc(settings.logo)}" style="max-height: 80px; max-width: 180px; margin: 0 auto 8px; display: block;" />`
        : ''
      }
      <h1 style="margin: 0; font-size: 20px; color: #0f172a; font-weight: bold;">${escapeHtml(settings.factoryName)}</h1>
      ${settings.factoryNameEn ? `<p style="margin: 2px 0; font-size: 12px; color: #64748b;">${escapeHtml(settings.factoryNameEn)}</p>` : ''}
      ${settings.slogan ? `<p style="margin: 4px 0; font-size: 11px; color: #475569;">${escapeHtml(settings.slogan)}</p>` : ''}
      <div style="margin-top: 8px; font-size: 10px; color: #64748b;">
        ${settings.phone ? `<span>📞 ${escapeHtml(settings.phone)}</span>` : ''}
        ${settings.address ? ` <span style="margin: 0 8px;">|</span> <span>📍 ${escapeHtml(settings.address)}</span>` : ''}
        ${settings.email ? ` <span style="margin: 0 8px;">|</span> <span>✉️ ${escapeHtml(settings.email)}</span>` : ''}
      </div>
      ${(settings.taxNumber || settings.commercialRegister) ? `
        <div style="margin-top: 4px; font-size: 10px; color: #64748b;">
          ${settings.taxNumber ? `<span>س.ض: ${escapeHtml(settings.taxNumber)}</span>` : ''}
          ${settings.commercialRegister ? ` <span style="margin: 0 8px;">|</span> <span>س.ت: ${escapeHtml(settings.commercialRegister)}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `
}

/**
 * توليد HTML لتذييل الفاتورة
 */
export function buildFactoryFooter(settings: FactorySettings): string {
  return `
    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px dashed #94a3b8; text-align: center; font-size: 10px; color: #64748b;">
      <p>${escapeHtml(settings.invoiceFooter || 'شكراً لتعاملكم معنا')}</p>
      ${settings.whatsapp ? `<p>واتساب: ${escapeHtml(settings.whatsapp)}</p>` : ''}
    </div>
  `
}

/**
 * توليد ترويسة المصنع بصيغة نص بسيط (للطابعات الحرارية ESC/POS)
 */
export function buildFactoryHeaderText(settings: FactorySettings): string {
  const lines = [
    settings.factoryName,
    settings.slogan || '',
    settings.phone ? `هاتف: ${settings.phone}` : '',
    settings.address || '',
    settings.taxNumber ? `س.ض: ${settings.taxNumber}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}
