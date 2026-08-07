// TODO: Integrate these Zod schemas into API route validation

import { z } from 'zod'

// ====== Schemas للتحقق من البيانات ======

export const saleItemSchema = z.object({
  itemName: z.string().min(1, 'اسم الصنف مطلوب'),
  quantity: z.number().positive('الكمية يجب أن تكون موجبة'),
  unitPrice: z.number().nonnegative('السعر يجب أن يكون موجباً أو صفر'),
})

export const saleSchema = z.object({
  customerName: z.string().min(1, 'اسم العميل مطلوب'),
  customerId_ref: z.string().optional().nullable(),
  invoiceNo: z.string().optional().nullable(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  paid: z.number().nonnegative('المدفوع يجب أن يكون موجباً أو صفر'),
  notes: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, 'صنف واحد على الأقل مطلوب'),
})

export const purchaseSchema = z.object({
  supplierName: z.string().min(1, 'اسم المورد مطلوب'),
  supplierId_ref: z.string().optional().nullable(),
  invoiceNo: z.string().optional().nullable(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  paid: z.number().nonnegative('المدفوع يجب أن يكون موجباً أو صفر'),
  notes: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, 'صنف واحد على الأقل مطلوب'),
})

export const workerSchema = z.object({
  name: z.string().min(1, 'اسم الموظف مطلوب'),
  phone: z.string().optional().nullable(),
  job: z.string().optional().nullable(),
  type: z.enum(['monthly', 'production', 'hourly']),
  notes: z.string().optional().nullable(),
})

export const customerSchema = z.object({
  name: z.string().min(1, 'اسم العميل مطلوب'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const supplierSchema = z.object({
  name: z.string().min(1, 'اسم المورد مطلوب'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const expenseSchema = z.object({
  categoryId: z.string().min(1, 'بند المصروف مطلوب'),
  amount: z.number().positive('المبلغ يجب أن يكون موجباً'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  notes: z.string().optional().nullable(),
})

export const productionSchema = z.object({
  workerId: z.string().min(1, 'الموظف مطلوب'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  modelName: z.string().min(1, 'اسم الموديل مطلوب'),
  quantity: z.number().positive('الكمية يجب أن تكون موجبة'),
  unitPrice: z.number().nonnegative('السعر يجب أن يكون موجباً أو صفر'),
  notes: z.string().optional().nullable(),
})

export const workerAdvanceSchema = z.object({
  workerId: z.string().min(1, 'الموظف مطلوب'),
  amount: z.number().positive('المبلغ يجب أن يكون موجباً'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  notes: z.string().optional().nullable(),
})

export const factorySettingsSchema = z.object({
  factoryName: z.string().min(1, 'اسم المصنع مطلوب'),
  factoryNameEn: z.string().optional().nullable(),
  slogan: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  address: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  commercialRegister: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  currency: z.string().min(1, 'العملة مطلوبة'),
  invoicePrefix: z.string().optional().nullable(),
  invoiceFooter: z.string().optional().nullable(),
  defaultPaperSize: z.string().optional().nullable(),
})

export const treasuryTransactionSchema = z.object({
  type: z.enum(['deposit', 'withdrawal']),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون موجباً'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  description: z.string().min(1, 'الوصف مطلوب'),
  category: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// دالة مساعدة للتحقق من البيانات
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`)
  return { success: false, errors }
}
