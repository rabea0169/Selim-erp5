import { describe, it, expect } from 'vitest'
import {
  computeInvoiceTotals,
  assertValidPaid,
  weightedAverageCost,
  treasuryBalance,
  partyOutstanding,
} from '../src/lib/calc'

// ============================================================
// وحدة المحاسبة: حساب إجماليات الفواتير
// ============================================================
describe('computeInvoiceTotals — حساب إجماليات الفاتورة', () => {
  it('يحسب subtotal بدون خصم أو ضريبة أو رسوم', () => {
    const r = computeInvoiceTotals({
      items: [
        { quantity: 2, unitPrice: 100 },
        { quantity: 3, unitPrice: 50 },
      ],
    })
    expect(r.subtotal).toBe(350)
    expect(r.discountAmount).toBe(0)
    expect(r.taxAmount).toBe(0)
    expect(r.total).toBe(350)
  })

  it('يطبق الخصم بالنسبة المئوية على subtotal', () => {
    const r = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 200 }],
      discountType: 'percentage',
      discountValue: 10,
    })
    expect(r.discountAmount).toBe(20)
    expect(r.total).toBe(180)
  })

  it('يطبق الخصم الثابت كمبلغ مباشر', () => {
    const r = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 200 }],
      discountType: 'fixed',
      discountValue: 50,
    })
    expect(r.discountAmount).toBe(50)
    expect(r.total).toBe(150)
  })

  it('يحسب الضريبة على الصافي بعد الخصم وليس على subtotal', () => {
    // 1000 - 10% = 900 → ضريبة 14% على 900 = 126
    const r = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 1000 }],
      discountType: 'percentage',
      discountValue: 10,
      taxRate: 14,
    })
    expect(r.subtotal).toBe(1000)
    expect(r.discountAmount).toBe(100)
    expect(r.taxAmount).toBeCloseTo(126)
    expect(r.total).toBeCloseTo(1026)
  })

  it('يضيف الرسوم الإضافية بعد الضريبة', () => {
    const r = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 100 }],
      taxRate: 10,
      extraFees: 25,
    })
    expect(r.taxAmount).toBe(10)
    expect(r.total).toBe(135)
  })

  it('يتعامل مع القيم النصية (strings) القادمة من النماذج', () => {
    const r = computeInvoiceTotals({
      items: [{ quantity: '4', unitPrice: '25.5' }],
      taxRate: '0',
    })
    expect(r.subtotal).toBe(102)
    expect(r.total).toBe(102)
  })

  it('قائمة أصناف فارغة تعطي صفراً', () => {
    const r = computeInvoiceTotals({ items: [] })
    expect(r.subtotal).toBe(0)
    expect(r.total).toBe(0)
  })
})

// ============================================================
// وحدة المحاسبة: التحقق من المبلغ المدفوع
// ============================================================
describe('assertValidPaid — التحقق من المدفوع', () => {
  it('يرفض المبلغ السالب', () => {
    expect(assertValidPaid(-5, 100)).toBe('المبلغ المدفوع لا يمكن أن يكون سالباً')
  })

  it('يرفض المبلغ المتجاوز للإجمالي', () => {
    expect(assertValidPaid(150, 100)).toContain('يتجاوز إجمالي الفاتورة')
  })

  it('يقبل الدفع الكامل والجزئي والصفري', () => {
    expect(assertValidPaid(100, 100)).toBeNull()
    expect(assertValidPaid(40, 100)).toBeNull()
    expect(assertValidPaid(0, 100)).toBeNull()
  })
})

// ============================================================
// وحدة المخازن: متوسط التكلفة المرجح للمواد الخام
// ============================================================
describe('weightedAverageCost — متوسط التكلفة المرجح', () => {
  it('يحسب المتوسط الصحيح عند إضافة مشتريات لمخزون قائم', () => {
    // 10 وحدات @ 5 + 10 وحدات @ 15 → (50 + 150) / 20 = 10
    expect(weightedAverageCost(10, 5, 10, 15)).toBe(10)
  })

  it('يعتمد سعر الشراء عندما يكون المخزون فارغاً', () => {
    expect(weightedAverageCost(0, 0, 5, 20)).toBe(20)
  })

  it('الكمية القديمة بسعر قديم لا تتأثر سلباً بالشراء بسعر أعلى', () => {
    // 100 @ 8 + 1 @ 100 → (800 + 100) / 101 ≈ 8.91
    expect(weightedAverageCost(100, 8, 1, 100)).toBeCloseTo(8.9109, 3)
  })

  it('الحالة الحدّية: الكمية الكلية صفر تعتمد سعر الشراء الجديد', () => {
    expect(weightedAverageCost(0, 99, 0, 12)).toBe(12)
  })
})

// ============================================================
// وحدة المحاسبة: رصيد الخزينة
// ============================================================
describe('treasuryBalance — رصيد الخزينة', () => {
  it('الإيداعات تزيد الرصيد والسحوبات تنقصه', () => {
    const balance = treasuryBalance([
      { type: 'deposit', amount: 1000 },
      { type: 'withdrawal', amount: 250 },
      { type: 'deposit', amount: 500 },
    ])
    expect(balance).toBe(1250)
  })

  it('يعامل transfer كسحب (حركة صادرة من الخزينة)', () => {
    const balance = treasuryBalance([
      { type: 'deposit', amount: 300 },
      { type: 'transfer', amount: 100 },
    ])
    expect(balance).toBe(200)
  })

  it('خزينة فارغة رصيدها صفر ويتعامل مع مبالغ نصية', () => {
    expect(treasuryBalance([])).toBe(0)
    expect(treasuryBalance([{ type: 'deposit', amount: '75.5' }])).toBe(75.5)
  })
})

// ============================================================
// وحدة المحاسبة: المتبقي على عميل/مورد
// ============================================================
describe('partyOutstanding — المتبقي على طرف', () => {
  it('يحسب المتبقي = الفواتير - المدفوع - المرتجعات', () => {
    expect(partyOutstanding(1000, 600, 100)).toBe(300)
  })

  it('لا يعيد قيمة سالبة أبداً (سداد زائد أو مرتجع كامل)', () => {
    expect(partyOutstanding(500, 500, 500)).toBe(0)
    expect(partyOutstanding(100, 200, 0)).toBe(0)
  })
})
