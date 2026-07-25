// حساب إجماليات الفاتورة على السيرفر (الخصم والضريبة والمصاريف الإضافية)

export interface InvoiceTotalsInput {
  subtotal: number
  discountType?: string | null
  discountValue?: number | string | null
  taxRate?: number | string | null
  extraFees?: number | string | null
}

export interface InvoiceTotals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  extraFees: number
  total: number
}

function num(value: unknown): number {
  const n = Number(value)
  return isNaN(n) ? 0 : n
}

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = num(input.subtotal)
  const discountValue = Math.max(0, num(input.discountValue))

  let discountAmount = 0
  if (input.discountType === 'percent') {
    discountAmount = (subtotal * Math.min(discountValue, 100)) / 100
  } else if (input.discountType === 'amount') {
    discountAmount = discountValue
  }
  discountAmount = Math.min(discountAmount, subtotal)

  const afterDiscount = subtotal - discountAmount
  const taxRate = Math.max(0, num(input.taxRate))
  const taxAmount = (afterDiscount * taxRate) / 100
  const extraFees = Math.max(0, num(input.extraFees))

  return {
    subtotal,
    discountAmount,
    taxAmount,
    extraFees,
    total: afterDiscount + taxAmount + extraFees,
  }
}
