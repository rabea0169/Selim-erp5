/**
 * أداة مساعدة للوصول إلى سجل جهات الاتصال في الموبايل
 * تستخدم Contacts Picker API (مدعوم في Chrome على Android و Safari على iOS 14.5+)
 */

export interface SelectedContact {
  name: string
  phone: string
}

/**
 * التحقق من دعم المتصفح لـ Contacts Picker API
 */
export function isContactsPickerSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof (navigator as any).contacts?.select === 'function'
  )
}

/**
 * فتح نافذة اختيار جهة اتصال من سجل الهاتف
 * يعيد الاسم ورقم الهاتف، أو null إذا تم الإلغاء
 */
export async function pickContactFromPhone(): Promise<SelectedContact | null> {
  if (!isContactsPickerSupported()) {
    throw new Error(
      'متصفحك لا يدعم اختيار جهات الاتصال. هذه الميزة تعمل على متصفح Chrome في الأندرويد أو Safari في iOS 14.5+'
    )
  }

  try {
    const props = ['name', 'tel'] as const
    const opts = { multiple: false }
    const contacts = await (navigator as any).contacts.select(props, opts)

    if (!contacts || contacts.length === 0) {
      return null // المستخدم ألغى الاختيار
    }

    const contact = contacts[0]
    const name = Array.isArray(contact.name) ? contact.name[0] || '' : contact.name || ''
    const phone = Array.isArray(contact.tel) ? contact.tel[0] || '' : contact.tel || ''

    return {
      name: String(name).trim(),
      phone: String(phone).trim(),
    }
  } catch (err: any) {
    if (err.name === 'SecurityError' || err.name === 'AbortError' || err.name === 'NotAllowedError') {
      return null
    }
    throw err
  }
}
