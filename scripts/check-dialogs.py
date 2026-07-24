#!/usr/bin/env python3
"""فحص كل DialogContent والتأكد من وجود DialogTitle"""
import re
import os
from pathlib import Path

PROJECT_ROOT = Path('/home/z/my-project/src/components/factory')
issues = []

for filepath in PROJECT_ROOT.rglob('*.tsx'):
    content = filepath.read_text(encoding='utf-8')
    
    # البحث عن كل DialogContent
    dialog_matches = list(re.finditer(r'<DialogContent', content))
    
    for match in dialog_matches:
        # البحث عن نهاية الـ DialogContent
        start = match.start()
        end_match = re.search(r'</DialogContent>', content[start:])
        if not end_match:
            continue
        
        dialog_content = content[start:start + end_match.end()]
        
        # التحقق من وجود DialogTitle
        if 'DialogTitle' not in dialog_content:
            line_num = content[:start].count('\n') + 1
            issues.append(f"❌ {filepath.relative_to(PROJECT_ROOT)}:{line_num} - DialogContent بدون DialogTitle")

if issues:
    print(f"🔴 وجد {len(issues)} مشكلة:\n")
    for issue in issues:
        print(f"  {issue}")
else:
    print("✅ كل الـ Dialogs فيها DialogTitle")
