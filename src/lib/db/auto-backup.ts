'use client'

import { reportRepository } from './repositories'

const AUTO_BACKUP_KEY = 'lastAutoBackup'
const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000 // يوم واحد

class AutoBackupService {
  private intervalId: NodeJS.Timeout | null = null

  // بدء النسخ الاحتياطي التلقائي
  start() {
    if (typeof window === 'undefined') return

    // فحص فوري عند البدء
    this.checkAndBackup()

    // فحص كل ساعة
    this.intervalId = setInterval(() => {
      this.checkAndBackup()
    }, 60 * 60 * 1000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async checkAndBackup() {
    const lastBackup = localStorage.getItem(AUTO_BACKUP_KEY)
    const dayAgo = Date.now() - AUTO_BACKUP_INTERVAL

    if (!lastBackup || Number(lastBackup) < dayAgo) {
      // نسخ احتياطي تلقائي محلي
      try {
        const data = await reportRepository.exportAll()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })

        // تخزين في IndexedDB بدلاً من تنزيل ملف
        const cache = await caches.open('auto-backups')
        const response = new Response(blob)
        await cache.put(`/auto-backup-${Date.now()}`, response)

        localStorage.setItem(AUTO_BACKUP_KEY, String(Date.now()))
        console.log('✅ Auto backup saved')
      } catch (e) {
        console.error('Auto backup failed:', e)
      }
    }
  }

  // استرجاع آخر نسخة احتياطية تلقائية
  async getLastAutoBackup(): Promise<any | null> {
    try {
      const cache = await caches.open('auto-backups')
      const keys = await cache.keys()
      if (keys.length === 0) return null

      // ترتيب حسب التاريخ (الأحدث آخر)
      const sortedKeys = keys.sort((a, b) => {
        const timeA = Number(a.url.split('auto-backup-')[1])
        const timeB = Number(b.url.split('auto-backup-')[1])
        return timeB - timeA
      })

      const response = await cache.match(sortedKeys[0])
      const text = await response?.text()
      return text ? JSON.parse(text) : null
    } catch {
      return null
    }
  }

  // الحصول على تاريخ آخر نسخة
  getLastBackupDate(): Date | null {
    const ts = localStorage.getItem(AUTO_BACKUP_KEY)
    return ts ? new Date(Number(ts)) : null
  }
}

export const autoBackupService = new AutoBackupService()
