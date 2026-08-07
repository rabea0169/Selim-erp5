'use client'

import { BaseRepository } from './base'
import { apiGet, apiPost } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { WorkerAttendance } from '../types'

/**
 * Worker attendance repository — API-based.
 * GET /api/attendance returns { attendance: [...], pagination: {...} }
 */
class WorkerAttendanceRepository extends BaseRepository<WorkerAttendance> {
  constructor() {
    super('/api/attendance', 'attendance')
  }

  /** Get all attendance records for a specific worker */
  async getByWorker(workerId: string): Promise<WorkerAttendance[]> {
    const res: any = await apiGet('/api/attendance', { workerId })
    if (Array.isArray(res)) return res as WorkerAttendance[]
    if (res?.attendance) return res.attendance as WorkerAttendance[]
    // Auto-detect first array key
    for (const key of Object.keys(res || {})) {
      if (key === 'pagination') continue
      if (Array.isArray(res[key])) return res[key] as WorkerAttendance[]
    }
    return []
  }

  /** Get attendance records for a specific date */
  async getByDate(date: string): Promise<WorkerAttendance[]> {
    return this.getByDateRange(date, date)
  }

  /** Get attendance records within a date range, optionally filtered by worker */
  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<WorkerAttendance[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    if (workerId) params.workerId = workerId

    const res: any = await apiGet('/api/attendance', params)
    if (Array.isArray(res)) return res as WorkerAttendance[]
    if (res?.attendance) return res.attendance as WorkerAttendance[]
    for (const key of Object.keys(res || {})) {
      if (key === 'pagination') continue
      if (Array.isArray(res[key])) return res[key] as WorkerAttendance[]
    }
    return []
  }

  /** Find existing attendance record for a worker on a specific date */
  async findExistingForDay(workerId: string, date: string): Promise<WorkerAttendance | undefined> {
    const records = await this.getByDateRange(date, date, workerId)
    return records.find(r => r.workerId === workerId && r.date === date)
  }

  /** Create or update attendance (server handles upsert logic) */
  async upsert(data: any): Promise<WorkerAttendance> {
    const res: any = await apiPost('/api/attendance', data)
    dataChangeEmitter.notifyCreate('workerAttendance')
    // فك تغليف الاستجابة — السيرفر يعيد { attendance, updated/created }
    return (res?.attendance || res) as WorkerAttendance
  }
}

const workerAttendanceRepository = new WorkerAttendanceRepository()

export { workerAttendanceRepository }
