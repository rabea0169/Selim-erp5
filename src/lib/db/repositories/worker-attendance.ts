import { BaseRepository } from './base'
import type { WorkerAttendance } from '../types'

class WorkerAttendanceRepository extends BaseRepository<WorkerAttendance> {
  constructor() {
    super('workerAttendance', true)
  }

  async getByWorker(workerId: string): Promise<WorkerAttendance[]> {
    const result = await this.getByIndex('by-worker', workerId)
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDate(date: string): Promise<WorkerAttendance[]> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const db = await this.getDB()
    const all = await db.getAllFromIndex(
      'workerAttendance',
      'by-date',
      IDBKeyRange.bound(startOfDay.toISOString(), endOfDay.toISOString())
    )
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<WorkerAttendance[]> {
    let result: WorkerAttendance[]
    if (from || to) {
      const db = await this.getDB()
      if (from && to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        result = await db.getAllFromIndex(
          'workerAttendance',
          'by-date',
          IDBKeyRange.bound(from, toDate.toISOString())
        )
      } else if (from) {
        result = await db.getAllFromIndex('workerAttendance', 'by-date', IDBKeyRange.lowerBound(from))
      } else {
        const toDate = new Date(to!)
        toDate.setHours(23, 59, 59, 999)
        result = await db.getAllFromIndex('workerAttendance', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
      }
    } else {
      result = await this.getAll()
    }

    if (workerId) {
      result = result.filter((a) => a.workerId === workerId)
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  // البحث عن سجل موجود لنفس العامل في نفس اليوم
  async findExistingForDay(workerId: string, date: string): Promise<WorkerAttendance | undefined> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const db = await this.getDB()
    const records = await db.getAllFromIndex(
      'workerAttendance',
      'by-date',
      IDBKeyRange.bound(startOfDay.toISOString(), endOfDay.toISOString())
    )
    return records.find((r) => r.workerId === workerId)
  }

  // حفظ أو تحديث (upsert) سجل الحضور
  async upsert(data: Partial<WorkerAttendance> & { workerId: string; date: string }): Promise<WorkerAttendance> {
    const existing = await this.findExistingForDay(data.workerId, data.date)
    if (existing) {
      const updated = await this.update(existing.id, data)
      return updated || existing
    }
    return this.create(data)
  }
}

export const workerAttendanceRepository = new WorkerAttendanceRepository()
