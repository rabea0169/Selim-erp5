// العميل (IndexedDB والواجهة) يستخدم حقلاً واحداً partyId،
// بينما قاعدة البيانات تفصل الطرف إلى customerId أو supplierId حسب النوع.

export function isSupplierPayment(type?: string): boolean {
  return !!type && type.startsWith('supplier')
}

export function toPartyColumns(type: string, partyId: string | null | undefined) {
  if (!partyId) return { customerId: null, supplierId: null }
  return isSupplierPayment(type)
    ? { customerId: null, supplierId: partyId }
    : { customerId: partyId, supplierId: null }
}

export function withPartyId<T extends { customerId?: string | null; supplierId?: string | null }>(
  payment: T
): T & { partyId: string | null } {
  return { ...payment, partyId: payment.customerId || payment.supplierId || null }
}
