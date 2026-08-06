'use client'

import { saleRepository, customerRepository, workerAttendanceRepository, factorySettingsRepository, workerRepository, expenseRepository, productRepository, materialRepository } from './repositories'
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
      const allWorkers = await workerRepository.getAll()
      const uniqueAttendedWorkers = new Set(todayAttendance.map((a: any) => a.workerId))
      const absentWorkers = allWorkers.length - uniqueAttendedWorkers.size
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
      const lastBackup = localStorage.getItem('lastAutoDownload') || localStorage.getItem('lastBackupDate')
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
      const monthExpenses = await expenseRepository.getByDateRange(startOfMonth.toISOString().split('T')[0], today)
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

      // 6. منتجات وصلت لحد إعادة الطلب (مخزون منخفض)
      try {
        const allProducts = await productRepository.getAll()
        const lowProducts = allProducts.filter((p) => p.reorderLevel && p.quantity <= p.reorderLevel)
        if (lowProducts.length > 0) {
          alerts.push({
            id: 'low-stock-products',
            type: 'danger',
            title: 'منتجات منخفضة',
            message: `${lowProducts.length} منتج وصل لحد إعادة الطلب: ${lowProducts.slice(0, 3).map((p) => p.name).join('، ')}${lowProducts.length > 3 ? '...' : ''}`,
            icon: '📦',
            actionLabel: 'عرض المنتجات',
            actionType: 'navigate',
            actionTarget: 'products',
          })
        }
      } catch {}

      // 7. خامات وصلت لحد إعادة الطلب
      try {
        const allMaterials = await materialRepository.getAll()
        const lowMaterials = allMaterials.filter((m) => m.reorderLevel && m.quantity <= m.reorderLevel)
        if (lowMaterials.length > 0) {
          alerts.push({
            id: 'low-stock-materials',
            type: 'warning',
            title: 'خامات منخفضة',
            message: `${lowMaterials.length} خامة وصلت لحد إعادة الطلب: ${lowMaterials.slice(0, 3).map((m) => m.name).join('، ')}${lowMaterials.length > 3 ? '...' : ''}`,
            icon: '🏭',
            actionLabel: 'عرض المخازن',
            actionType: 'navigate',
            actionTarget: 'warehouses',
          })
        }
      } catch {}
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
