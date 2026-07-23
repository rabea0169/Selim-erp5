// أنواع مشتركة لقسم العمال

import type { WorkerAdvance, WorkerReceipt } from '@/lib/db'

export interface WorkerWithStats {
  id: string
  name: string
  phone: string | null
  job: string | null
  type: string
  notes: string | null
  advances: WorkerAdvance[]
  receipts: WorkerReceipt[]
  totalAdvances: number
  totalReceipts: number
  balance: number
}

export interface WorkerBasic {
  id: string
  name: string
  phone: string | null
  job: string | null
  type: string
  notes: string | null
}
