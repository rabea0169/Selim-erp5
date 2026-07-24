#!/usr/bin/env python3
"""إضافة DialogDescription لكل DialogContent الذي يفتقر إليها"""
import re
from pathlib import Path

PROJECT_ROOT = Path('/home/z/my-project/src/components/factory')

# خريطة الوصف المناسب لكل ملف
DESCRIPTIONS = {
    'TreasuryView.tsx': 'إدارة معاملات الخزينة',
    'PrintSettingsDialog.tsx': 'إعدادات الطباعة وأنواع الورق',
    'SuppliersView.tsx': 'إدارة بيانات الموردين',
    'ProductionView.tsx': 'تسجيل إنتاج الموظفين بالقطعة',
    'FactorySettingsView.tsx': 'إدارة بيانات المصنع',
    'ProductsView.tsx': 'إدارة المنتجات وأسعارها',
    'BackupRestore.tsx': 'النسخ الاحتياطي والاسترجاع',
    'WorkerReportModal.tsx': 'تقرير الموظف الكامل',
    'CustomersView.tsx': 'إدارة بيانات العملاء',
    'WarehousesView.tsx': 'إدارة المخازن والمواد',
    'ProductionOrdersView.tsx': 'إدارة أوامر التشغيل',
    'PrintButton.tsx': 'معاينة وطباعة المستند',
    'SaleForm.tsx': 'فاتورة مبيعات جديدة',
    'WorkerForm.tsx': 'إضافة موظف جديد',
    'TransactionForm.tsx': 'تسجيل سلفة أو قبض',
    'PurchaseForm.tsx': 'فاتورة مشتريات جديدة',
    'ExpenseForm.tsx': 'تسجيل مصروف جديد',
    'CategoryManager.tsx': 'إدارة بنود المصاريف',
    'StatusDialog.tsx': 'تسجيل غياب أو إجازة',
    'TimePickerDialog.tsx': 'اختيار وقت الحضور أو الانصراف',
}

fixed_count = 0

for filepath in PROJECT_ROOT.rglob('*.tsx'):
    content = filepath.read_text(encoding='utf-8')
    filename = filepath.name
    modified = False
    
    # التحقق من استيراد DialogDescription
    needs_import = False
    
    # البحث عن كل DialogContent
    dialog_matches = list(re.finditer(r'<DialogContent', content))
    
    for match in reversed(dialog_matches):  # عكسي عشان المواقع متتأثرش
        start = match.start()
        end_match = re.search(r'</DialogContent>', content[start:])
        if not end_match:
            continue
        
        dialog_content = content[start:start + end_match.end()]
        
        if 'DialogDescription' not in dialog_content and 'aria-describedby' not in dialog_content:
            # البحث عن DialogTitle أو أول عنصر بعد DialogContent
            title_match = re.search(r'<DialogTitle[^>]*>(.*?)</DialogTitle>', dialog_content, re.DOTALL)
            
            if title_match:
                # إضافة DialogDescription بعد DialogTitle
                title_end = start + title_match.end()
                desc = DESCRIPTIONS.get(filename, 'نافذة تفاعلية')
                insertion = f'\n          <DialogDescription className="sr-only">{desc}</DialogDescription>'
                content = content[:title_end] + insertion + content[title_end:]
                needs_import = True
                modified = True
                fixed_count += 1
    
    if needs_import:
        # إضافة DialogDescription للاستيرادات
        import_pattern = r'(import \{[^}]*DialogTitle[^}]*\} from \'@/components/ui/dialog\')'
        import_match = re.search(import_pattern, content)
        if import_match and 'DialogDescription' not in import_match.group(0):
            old_import = import_match.group(0)
            new_import = old_import.replace('DialogTitle,', 'DialogTitle,\n  DialogDescription,')
            content = content.replace(old_import, new_import)
    
    if modified:
        filepath.write_text(content, encoding='utf-8')
        print(f"✅ {filename} - تم إصلاح DialogDescription")

print(f"\n🎉 تم إصلاح {fixed_count} نافذة منبثقة")
