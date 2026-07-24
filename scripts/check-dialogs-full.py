#!/usr/bin/env python3
"""فحص كل DialogContent للتأكد من وجود DialogTitle و DialogDescription"""
import re
from pathlib import Path

PROJECT_ROOT = Path('/home/z/my-project/src/components/factory')
issues = []

for filepath in PROJECT_ROOT.rglob('*.tsx'):
    content = filepath.read_text(encoding='utf-8')
    
    dialog_matches = list(re.finditer(r'<DialogContent', content))
    
    for match in dialog_matches:
        start = match.start()
        end_match = re.search(r'</DialogContent>', content[start:])
        if not end_match:
            continue
        
        dialog_content = content[start:start + end_match.end()]
        line_num = content[:start].count('\n') + 1
        
        if 'DialogTitle' not in dialog_content:
            issues.append(f"❌ {filepath.name}:{line_num} - DialogContent بدون DialogTitle")
        
        if 'DialogDescription' not in dialog_content and 'aria-describedby' not in dialog_content:
            issues.append(f"⚠️ {filepath.name}:{line_num} - DialogContent بدون DialogDescription")

if issues:
    print(f"وجد {len(issues)} مشكلة:\n")
    for issue in issues:
        print(f"  {issue}")
else:
    print("✅ كل الـ Dialogs فيها DialogTitle و DialogDescription")
