'use client'

import { reportRepository } from './repositories'

const AUTO_BACKUP_KEY = 'lastAutoDownload'
const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000 // يوم واحد
const AUTO_BACKUP_ENABLED_KEY = 'autoDownloadEnabled'

interface BackupInfo {
  date: string
  fileName: string
  size: string
  recordsCount: number
}

class AutoBackupService {
  private intervalId: ReturnType<typeof setInterval> | null = null

  // بدء النسخ الاحتياطي التلقائي
  start() {
    if (typeof window === 'undefined') return

    // فحص فوري عند البدء (بعد 30 ثانية من فتح التطبيق)
    setTimeout(() => {
      Promise.resolve().then(() => this.checkAndDownload())
    }, 30000)

    // فحص كل ساعة
    this.intervalId = setInterval(() => {
      Promise.resolve().then(() => this.checkAndDownload())
    }, 60 * 60 * 1000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  // تفعيل/تعطيل النسخ التلقائي
  isEnabled(): boolean {
    return localStorage.getItem(AUTO_BACKUP_ENABLED_KEY) !== 'false'
  }

  setEnabled(enabled: boolean) {
    localStorage.setItem(AUTO_BACKUP_ENABLED_KEY, String(enabled))
  }

  // الفحص والتنزيل التلقائي
  private async checkAndDownload() {
    if (!this.isEnabled()) return

    const lastBackup = localStorage.getItem(AUTO_BACKUP_KEY)
    const dayAgo = Date.now() - AUTO_BACKUP_INTERVAL

    if (!lastBackup || Number(lastBackup) < dayAgo) {
      await this.downloadBackup()
    }
  }

  // تنزيل نسخة احتياطية في مجلد Downloads
  async downloadBackup(): Promise<BackupInfo | null> {
    try {
      const data = await reportRepository.exportAll()
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })

      // اسم الملف: Selim-ERP-Backup-YYYY-MM-DD.json
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-')
      const fileName = `Selim-ERP-Backup-${dateStr}-${timeStr}.json`

      // تنزيل الملف في مجلد Downloads
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // تنظيف الـ URL بعد ثانية
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      // حفظ معلومات النسخة
      const sizeKB = (blob.size / 1024).toFixed(1)
      const recordsCount = this.countRecords(data)
      const info: BackupInfo = {
        date: now.toISOString(),
        fileName,
        size: `${sizeKB} KB`,
        recordsCount,
      }

      // حفظ في localStorage
      localStorage.setItem(AUTO_BACKUP_KEY, String(Date.now()))
      localStorage.setItem('lastBackupInfo', JSON.stringify(info))

      // أيضاً حفظ نسخة في Cache API كطبقة حماية إضافية
      try {
        const cache = await caches.open('auto-backups')
        const response = new Response(blob)
        await cache.put(`/auto-backup-${Date.now()}`, response)
      } catch {}

      console.log('✅ Auto backup downloaded:', fileName)
      return info
    } catch (e) {
      console.error('Auto backup download failed:', e)
      return null
    }
  }

  // عد السجلات في النسخة
  private countRecords(data: any): number {
    let count = 0
    if (data?.data) {
      for (const table of Object.keys(data.data)) {
        if (Array.isArray(data.data[table])) {
          count += data.data[table].length
        }
      }
    }
    return count
  }

  // الحصول على معلومات آخر نسخة
  getLastBackupInfo(): BackupInfo | null {
    try {
      const stored = localStorage.getItem('lastBackupInfo')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  // الحصول على تاريخ آخر نسخة
  getLastBackupDate(): Date | null {
    const ts = localStorage.getItem(AUTO_BACKUP_KEY)
    return ts ? new Date(Number(ts)) : null
  }

  // هل النسخة قديمة؟ (أكثر من يوم)
  isBackupStale(): boolean {
    const last = this.getLastBackupDate()
    if (!last) return true
    return Date.now() - last.getTime() > AUTO_BACKUP_INTERVAL
  }

  // استرجاع آخر نسخة من Cache API (طبقة حماية إضافية)
  async getLastCacheBackup(): Promise<any | null> {
    try {
      const cache = await caches.open('auto-backups')
      const keys = await cache.keys()
      if (keys.length === 0) return null

      const sortedKeys = [...keys].sort((a, b) => {
        const timeA = Number(a.url.split('auto-backup-')[1] || 0)
        const timeB = Number(b.url.split('auto-backup-')[1] || 0)
        return timeB - timeA
      })

      const response = await cache.match(sortedKeys[0])
      const text = await response?.text()
      return text ? JSON.parse(text) : null
    } catch {
      return null
    }
  }

  // عدد النسخ المحفوظة في Cache
  async getCacheBackupsCount(): Promise<number> {
    try {
      const cache = await caches.open('auto-backups')
      const keys = await cache.keys()
      return keys.length
    } catch {
      return 0
    }
  }

  // تنظيف النسخ القديمة من Cache (الاحتفاظ بآخر 7 نسخ فقط)
  async cleanOldCacheBackups() {
    try {
      const cache = await caches.open('auto-backups')
      const keys = await cache.keys()

      if (keys.length <= 7) return

      // ترتيب من الأقدم للأحدث
      const sorted = [...keys].sort((a, b) => {
        const timeA = Number(a.url.split('auto-backup-')[1] || 0)
        const timeB = Number(b.url.split('auto-backup-')[1] || 0)
        return timeA - timeB
      })

      // حذف القديمة
      const toDelete = sorted.slice(0, sorted.length - 7)
      for (const key of toDelete) {
        await cache.delete(key)
      }

      console.log(`🧹 Cleaned ${toDelete.length} old cache backups`)
    } catch (e) {
      console.error('Failed to clean old backups:', e)
    }
  }
}

export const autoBackupService = new AutoBackupService()
export type { BackupInfo }
