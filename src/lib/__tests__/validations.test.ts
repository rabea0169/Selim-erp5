import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  customerSchema,
  expenseSchema,
  factorySettingsSchema,
  productionSchema,
  purchaseSchema,
  saleItemSchema,
  saleSchema,
  supplierSchema,
  validateData,
  workerAdvanceSchema,
  workerSchema,
} from '@/lib/validations'

const validItem = { itemName: 'كرسي', quantity: 2, unitPrice: 100 }

describe('saleItemSchema', () => {
  it('accepts a valid item', () => {
    expect(saleItemSchema.safeParse(validItem).success).toBe(true)
  })

  it('rejects an empty name, non-positive quantity and negative price', () => {
    expect(saleItemSchema.safeParse({ ...validItem, itemName: '' }).success).toBe(false)
    expect(saleItemSchema.safeParse({ ...validItem, quantity: 0 }).success).toBe(false)
    expect(saleItemSchema.safeParse({ ...validItem, unitPrice: -1 }).success).toBe(false)
  })

  it('accepts a zero unit price', () => {
    expect(saleItemSchema.safeParse({ ...validItem, unitPrice: 0 }).success).toBe(true)
  })
})

describe('saleSchema / purchaseSchema', () => {
  const sale = {
    customerName: 'عميل',
    date: '2024-01-15',
    paid: 0,
    items: [validItem],
  }

  it('accepts a minimal sale and allows nullable optional fields', () => {
    expect(saleSchema.safeParse(sale).success).toBe(true)
    expect(
      saleSchema.safeParse({ ...sale, invoiceNo: null, notes: null, customerId_ref: null }).success
    ).toBe(true)
  })

  it('requires at least one item', () => {
    const result = saleSchema.safeParse({ ...sale, items: [] })
    expect(result.success).toBe(false)
  })

  it('requires a customer name, a date and a non-negative paid amount', () => {
    expect(saleSchema.safeParse({ ...sale, customerName: '' }).success).toBe(false)
    expect(saleSchema.safeParse({ ...sale, date: '' }).success).toBe(false)
    expect(saleSchema.safeParse({ ...sale, paid: -5 }).success).toBe(false)
  })

  it('requires a supplier name for purchases', () => {
    const purchase = { supplierName: 'مورد', date: '2024-01-15', paid: 10, items: [validItem] }
    expect(purchaseSchema.safeParse(purchase).success).toBe(true)
    expect(purchaseSchema.safeParse({ ...purchase, supplierName: '' }).success).toBe(false)
  })
})

describe('workerSchema', () => {
  it('accepts the supported worker types', () => {
    for (const type of ['monthly', 'production', 'hourly']) {
      expect(workerSchema.safeParse({ name: 'عامل', type }).success).toBe(true)
    }
  })

  it('rejects an unknown worker type or a missing name', () => {
    expect(workerSchema.safeParse({ name: 'عامل', type: 'daily' }).success).toBe(false)
    expect(workerSchema.safeParse({ name: '', type: 'hourly' }).success).toBe(false)
  })
})

describe('customerSchema / supplierSchema', () => {
  it('only requires a name', () => {
    expect(customerSchema.safeParse({ name: 'عميل' }).success).toBe(true)
    expect(supplierSchema.safeParse({ name: 'مورد' }).success).toBe(true)
    expect(customerSchema.safeParse({ name: '' }).success).toBe(false)
    expect(supplierSchema.safeParse({}).success).toBe(false)
  })
})

describe('expenseSchema / workerAdvanceSchema / productionSchema', () => {
  it('requires a positive amount for expenses and advances', () => {
    expect(expenseSchema.safeParse({ categoryId: 'c1', amount: 0, date: '2024-01-15' }).success).toBe(false)
    expect(expenseSchema.safeParse({ categoryId: 'c1', amount: 50, date: '2024-01-15' }).success).toBe(true)
    expect(workerAdvanceSchema.safeParse({ workerId: 'w1', amount: -1, date: '2024-01-15' }).success).toBe(false)
    expect(workerAdvanceSchema.safeParse({ workerId: 'w1', amount: 1, date: '2024-01-15' }).success).toBe(true)
  })

  it('requires worker, model and quantity for production entries', () => {
    const production = {
      workerId: 'w1',
      date: '2024-01-15',
      modelName: 'موديل',
      quantity: 5,
      unitPrice: 0,
    }
    expect(productionSchema.safeParse(production).success).toBe(true)
    expect(productionSchema.safeParse({ ...production, modelName: '' }).success).toBe(false)
    expect(productionSchema.safeParse({ ...production, quantity: 0 }).success).toBe(false)
  })
})

describe('factorySettingsSchema', () => {
  const settings = { factoryName: 'مصنع سليم', currency: 'ج.م' }

  it('requires the factory name and currency', () => {
    expect(factorySettingsSchema.safeParse(settings).success).toBe(true)
    expect(factorySettingsSchema.safeParse({ ...settings, factoryName: '' }).success).toBe(false)
    expect(factorySettingsSchema.safeParse({ ...settings, currency: '' }).success).toBe(false)
  })

  it('accepts an empty email but rejects a malformed one', () => {
    expect(factorySettingsSchema.safeParse({ ...settings, email: '' }).success).toBe(true)
    expect(factorySettingsSchema.safeParse({ ...settings, email: 'a@b.com' }).success).toBe(true)
    expect(factorySettingsSchema.safeParse({ ...settings, email: 'not-an-email' }).success).toBe(false)
  })
})

describe('validateData', () => {
  it('returns the parsed data on success', () => {
    const result = validateData(customerSchema, { name: 'عميل' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('عميل')
  })

  it('returns dot-separated field paths with messages on failure', () => {
    const result = validateData(saleSchema, {
      customerName: '',
      date: '2024-01-15',
      paid: 0,
      items: [{ itemName: 'كرسي', quantity: -1, unitPrice: 0 }],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.startsWith('customerName: '))).toBe(true)
      expect(result.errors.some((e) => e.startsWith('items.0.quantity: '))).toBe(true)
    }
  })

  it('reports a root-level error with an empty path prefix', () => {
    const result = validateData(z.string(), 42)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.errors[0].startsWith(': ')).toBe(true)
  })
})
