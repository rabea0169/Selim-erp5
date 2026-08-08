'use client'

import { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface DataTableColumn {
  id: string
  header: string
  accessor: (row: any) => ReactNode
  className?: string
}

export interface DataTableProps {
  columns: DataTableColumn[]
  data: any[]
  isLoading?: boolean
  onRowClick?: (row: any) => void
}

/**
 * مكون جدول بيانات responsive
 * يعرض بطاقات على الهاتف وجدول على الشاشات الأكبر
 */
export function DataTable({
  columns,
  data,
  isLoading = false,
  onRowClick,
}: DataTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <p>لا توجد بيانات</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* عرض بطاقات على الهاتف والتابلت الصغير */}
      <div className="md:hidden space-y-4">
        {data.map((item, index) => (
          <Card
            key={index}
            className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onRowClick?.(item)}
          >
            <div className="space-y-3">
              {columns.map((column) => (
                <div key={column.id} className="flex justify-between items-start gap-2">
                  <span className="font-semibold text-sm text-gray-600">
                    {column.header}
                  </span>
                  <span className="text-sm text-right flex-1">
                    {column.accessor(item)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* عرض جدول على الشاشات الأكبر */}
      <div className="hidden md:block overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b">
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="px-4 py-3 text-right font-semibold text-sm text-gray-700"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={index}
                className="border-b hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-4 py-3 text-sm text-gray-700 ${column.className || ''}`}
                  >
                    {column.accessor(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
