'use client'

import { saleRepository, customerRepository, workerAttendanceRepository, factorySettingsRepository } from './repositories'
import { todayStr } from '@/lib/format'

export interface SmartAlert {
  id: string
  type: 'warning' | 'info' | 'danger' | 'success'
  title: string
  message: string
  icon: string
  actionLabel?: string
  actionType?: 'navigate' | 'dismiss'
  actionTarget?: string
}

class AlertsService {
  async getAlerts(): Promise<SmartAlert[]> {
    const alerts: SmartAlert[] = []
    const today = todayStr()

    try {
      // 1. مبالغ مستحقة على العملاء
      const customers = await customerRepository.getAllWithStats()
      const dueCustomers = customers.filter((c) => c.totalRemaining > 0)
      if (dueCustomers.length > 0) {
        const totalDue = dueCustomers.reduce((s, c) => s + c.totalRemaining, 0)
        alerts.push({
          id: 'due-customers',
          type: 'warning',
          title: 'مبالغ مستحقة',
          message: `${dueCustomers.length} عميل عليهم مبالغ متبقية بإجمالي ${totalDue.toLocaleString('ar-EG')} ج.م`,
          icon: '💰',
          actionLabel: 'عرض العملاء',
          actionType: 'navigate',
          actionTarget: 'sales',
        })
      }

      // 2. عمال لم يحضروا اليوم
      const todayAttendance = await workerAttendanceRepository.getByDate(today)
      const allWorkers = await import('./repositories').then((m) => m.workerRepository.getAll())
      const absentWorkers = allWorkers.length - todayAttendance.length
      if (absentWorkers > 0 && allWorkers.length > 0) {
        alerts.push({
          id: 'absent-workers',
          type: 'info',
          title: 'حضور اليوم',
          message: `${absentWorkers} موظف لم يتم تسجيل حضورهم اليوم`,
          icon: '⏰',
          actionLabel: 'تسجيل الحضور',
          actionType: 'navigate',
          actionTarget: 'workers',
        })
      }

      // 3. تذكير النسخ الاحتياطي
      const lastBackup = localStorage.getItem('lastBackupDate')
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      if (!lastBackup || Number(lastBackup) < weekAgo) {
        alerts.push({
          id: 'backup-reminder',
          type: 'danger',
          title: 'نسخة احتياطية',
          message: 'مر أكثر من أسبوع على آخر نسخة احتياطية. احفظ بياناتك!',
          icon: '💾',
          actionLabel: 'نسخ احتياطي',
          actionType: 'navigate',
          actionTarget: 'backup',
        })
      }

      // 4. مبيعات اليوم
      const todaySales = await saleRepository.getByDateRange(today, today)
      if (todaySales.length > 0) {
        const totalToday = todaySales.reduce((s, x) => s + x.total, 0)
        alerts.push({
          id: 'today-sales',
          type: 'success',
          title: 'مبيعات اليوم',
          message: `${todaySales.length} فاتورة اليوم بإجمالي ${totalToday.toLocaleString('ar-EG')} ج.م`,
          icon: '📈',
        })
      }

      // 5. فحص المصاريف الزائدة
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      const monthExpenses = await import('./repositories').then((m) =>
        m.expenseRepository.getByDateRange(startOfMonth.toISOString().split('T')[0], today)
      )
      const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0)
      if (totalExpenses > 50000) {
        alerts.push({
          id: 'high-expenses',
          type: 'warning',
          title: 'مصاريف مرتفعة',
          message: `إجمالي مصاريف الشهر ${totalExpenses.toLocaleString('ar-EG')} ج.م - راجعها`,
          icon: '⚠️',
          actionLabel: 'عرض المصاريف',
          actionType: 'navigate',
          actionTarget: 'expenses',
        })
      }
    } catch (e) {
      console.error('Failed to load alerts:', e)
    }

    return alerts
  }

  markBackupDone() {
    localStorage.setItem('lastBackupDate', String(Date.now()))
  }
}

export const alertsService = new AlertsService()
