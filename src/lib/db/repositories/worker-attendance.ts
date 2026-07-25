import { BaseRepository } from './base'
import { workerRepository } from './workers'
import { calculateAttendance } from '@/lib/attendance-calc'
import type { WorkerAttendance } from '../types'

class WorkerAttendanceRepository extends BaseRepository<WorkerAttendance> {
  constructor() {
    super('workerAttendance')
  }

  async getByWorker(workerId: string): Promise<WorkerAttendance[]> {
    const result = await this.getAll()
    return result
      .filter((a) => a.workerId === workerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDate(date: string): Promise<WorkerAttendance[]> {
    const result = await this.getAll()
    return result
      .filter((a) => a.date && a.date.startsWith(date))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<WorkerAttendance[]> {
    let result = await super.search(undefined, from, to)
    if (workerId) {
      result = result.filter((a) => a.workerId === workerId)
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async findExistingForDay(workerId: string, date: string): Promise<WorkerAttendance | undefined> {
    const records = await this.getAll()
    return records.find((r) => r.workerId === workerId && r.date && r.date.startsWith(date))
  }

  async upsert(data: Partial<WorkerAttendance> & { workerId: string; date: string }): Promise<WorkerAttendance> {
    const worker = await workerRepository.getById(data.workerId)

    const existing = await this.findExistingForDay(data.workerId, data.date)
    const merged: Partial<WorkerAttendance> = existing ? { ...existing, ...data } : data

    if (merged.checkIn && merged.checkOut && worker && merged.status === 'present') {
      const calc = calculateAttendance(merged as WorkerAttendance, worker)
      merged.workHours = calc.workHours
      merged.overtimeHours = calc.overtimeHours
      merged.lateMinutes = calc.lateMinutes
    }

    if (existing) {
      const updated = await this.update(existing.id, merged)
      return updated || existing
    }
    return this.create(merged)
  }
}

export const workerAttendanceRepository = new WorkerAttendanceRepository()
