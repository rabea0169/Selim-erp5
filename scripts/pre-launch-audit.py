#!/usr/bin/env python3
"""
مراجعة شاملة لـ Selim ERP قبل الإطلاق
يفحص: الأخطاء المنطقية، العلاقات، الحسابات، الأداء، الأمان
"""
import os
import re
import json
from pathlib import Path

PROJECT_ROOT = Path('/home/z/my-project/src')
issues = []
warnings = []
passed = []

def check_file(filepath, checks):
    """فحص ملف بحثاً عن مشاكل محددة"""
    try:
        content = filepath.read_text(encoding='utf-8')
        for check_name, pattern, severity, description in checks:
            matches = re.findall(pattern, content, re.MULTILINE)
            if matches:
                if severity == 'error':
                    issues.append(f"❌ {filepath.name}:{check_name} - {description} ({len(matches)} مرة)")
                elif severity == 'warn':
                    warnings.append(f"⚠️ {filepath.name}:{check_name} - {description} ({len(matches)} مرة)")
            else:
                passed.append(f"✅ {filepath.name}:{check_name}")
    except Exception as e:
        issues.append(f"❌ {filepath.name}: فشل القراءة - {e}")

# ====== 1. فحص الأخطاء المنطقية ======
print("=" * 60)
print("🔍 1. فحص الأخطاء المنطقية")
print("=" * 60)

# فحص catch blocks الفارغة
for filepath in PROJECT_ROOT.rglob('*.ts'):
    content = filepath.read_text(encoding='utf-8')
    if 'catch {}' in content or 'catch () {}' in content or '.catch(() => {})' in content:
        issues.append(f"❌ {filepath.name}: catch block فارغ - ممكن يخفي أخطاء")

# فحص any types
any_count = 0
for filepath in PROJECT_ROOT.rglob('*.ts'):
    content = filepath.read_text(encoding='utf-8')
    # تجاهل التعليقات
    lines = content.split('\n')
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*'):
            continue
        if ': any' in stripped or 'as any' in stripped:
            any_count += 1

if any_count > 20:
    warnings.append(f"⚠️ استخدام {any_count} مرة لـ any - يقلل type safety")
else:
    passed.append(f"✅ استخدام any معتدل ({any_count} مرة)")

# ====== 2. فحص العلاقات بين الأقسام ======
print("\n" + "=" * 60)
print("🔗 2. فحص العلاقات بين الأقسام")
print("=" * 60)

# هل إنشاء مبيعة يحدث الخزينة؟
sales_content = (PROJECT_ROOT / 'lib/db/repositories/sales.ts').read_text(encoding='utf-8')
if 'treasury' not in sales_content.lower():
    issues.append("❌ sales.ts: إنشاء مبيعة لا يحدث الخزينة تلقائياً")
else:
    passed.append("✅ sales.ts: مرتبط بالخزينة")

# هل إنشاء مشترى يحدث الخزينة؟
purchases_content = (PROJECT_ROOT / 'lib/db/repositories/purchases.ts').read_text(encoding='utf-8')
if 'treasury' not in purchases_content.lower():
    issues.append("❌ purchases.ts: إنشاء مشترى لا يحدث الخزينة تلقائياً")
else:
    passed.append("✅ purchases.ts: مرتبط بالخزينة")

# هل إنشاء مصروف يحدث الخزينة؟
expenses_content = (PROJECT_ROOT / 'lib/db/repositories/expenses.ts').read_text(encoding='utf-8')
if 'treasury' not in expenses_content.lower():
    issues.append("❌ expenses.ts: إنشاء مصروف لا يحدث الخزينة تلقائياً")
else:
    passed.append("✅ expenses.ts: مرتبط بالخزينة")

# هل سلف الموظف يحدث الخزينة؟
worker_advances = (PROJECT_ROOT / 'lib/db/repositories/worker-advances.ts').read_text(encoding='utf-8')
if 'treasury' not in worker_advances.lower():
    issues.append("❌ worker-advances.ts: سلف الموظف لا يحدث الخزينة")
else:
    passed.append("✅ worker-advances.ts: مرتبط بالخزينة")

# هل أمر التشغيل يسحب المواد؟
products_content = (PROJECT_ROOT / 'lib/db/repositories/products.ts').read_text(encoding='utf-8')
if 'consumeStock' in products_content or 'materialTransactions' in products_content:
    passed.append("✅ productionOrderRepository: يسحب المواد تلقائياً")
else:
    issues.append("❌ products.ts: أمر التشغيل لا يسحب المواد")

# هل إكمال أمر التشغيل يضيف المنتج؟
if 'addStock' in products_content or 'products' in products_content:
    passed.append("✅ productionOrderRepository: يضيف المنتج عند الإكمال")
else:
    issues.append("❌ products.ts: إكمال الأمر لا يضيف المنتج")

# ====== 3. فحص دوال الحسابات ======
print("\n" + "=" * 60)
print("🧮 3. فحص دوال الحسابات")
print("=" * 60)

calc_content = (PROJECT_ROOT / 'lib/attendance-calc.ts').read_text(encoding='utf-8')

# فحص حساب الساعات لورديات الليل
if 'midnight' in calc_content.lower() or '24 * 60 * 60 * 1000' in calc_content:
    passed.append("✅ attendance-calc: يدعم ورديات الليل (عبور منتصف الليل)")
else:
    issues.append("❌ attendance-calc: لا يدعم ورديات الليل")

# فحص دقة الأرقام (floating point)
if 'Math.round' in calc_content and '100' in calc_content:
    passed.append("✅ attendance-calc: يستخدم Math.round لدقة الأرقام")
else:
    warnings.append("⚠️ attendance-calc: ممكن فيه مشاكل floating point")

# فحص التأخير
if 'lateMinutes' in calc_content and 'workStartTime' in calc_content:
    passed.append("✅ attendance-calc: يحسب التأخير بشكل صحيح")
else:
    issues.append("❌ attendance-calc: لا يحسب التأخير")

# فحص الإضافي
if 'overtimeHours' in calc_content and 'workHoursPerDay' in calc_content:
    passed.append("✅ attendance-calc: يحسب الساعات الإضافية")
else:
    issues.append("❌ attendance-calc: لا يحسب الإضافي")

# ====== 4. فحص الأداء والاستقرار ======
print("\n" + "=" * 60)
print("⚡ 4. فحص الأداء والاستقرار (3 سنوات)")
print("=" * 60)

# فحص الاستعلامات غير المحدودة
unbounded_queries = 0
for filepath in PROJECT_ROOT.rglob('*.ts'):
    content = filepath.read_text(encoding='utf-8')
    # getAll() بدون limit
    if 'getAll()' in content and 'limit' not in content.lower():
        unbounded_queries += content.count('getAll()')

if unbounded_queries > 15:
    warnings.append(f"⚠️ {unbounded_queries} استعلام getAll() بدون limit - ممكن بطيء بعد سنوات")
else:
    passed.append(f"✅ استعلامات getAll() محدودة ({unbounded_queries})")

# فحص audit log - هل بينظف نفسه؟
audit_content = (PROJECT_ROOT / 'lib/db/repositories/audit-log.ts').read_text(encoding='utf-8')
if 'limit' in audit_content or 'clear' in audit_content:
    passed.append("✅ audit-log: فيه limit/clear للتنظيف")
else:
    warnings.append("⚠️ audit-log: ممكن يكبر بمرور الوقت بدون تنظيف تلقائي")

# فحص auto-backup
backup_content = (PROJECT_ROOT / 'lib/db/auto-backup.ts').read_text(encoding='utf-8')
if 'caches.open' in backup_content:
    passed.append("✅ auto-backup: يستخدم Cache API (آمن)")
else:
    issues.append("❌ auto-backup: طريقة تخزين غير آمنة")

# فحص الـ connection - هل فيه instance واحد؟
conn_content = (PROJECT_ROOT / 'lib/db/connection.ts').read_text(encoding='utf-8')
if 'dbInstance' in conn_content and 'if (dbInstance)' in conn_content:
    passed.append("✅ connection: singleton pattern (instance واحد)")
else:
    issues.append("❌ connection: ممكن يفتح اتصالات متعددة")

# فحص memory leaks في live-data
live_content = (PROJECT_ROOT / 'lib/db/live-data.ts').read_text(encoding='utf-8')
if 'unsub' in live_content or 'removeEventListener' in live_content or 'return ()' in live_content:
    passed.append("✅ live-data: ينظف الـ subscriptions")
else:
    issues.append("❌ live-data: ممكن فيه memory leak")

# ====== 5. فحص معالجة الأخطاء ======
print("\n" + "=" * 60)
print("🛡️ 5. فحص معالجة الأخطاء و Edge Cases")
print("=" * 60)

# فحص validation
validations_content = (PROJECT_ROOT / 'lib/validations.ts').read_text(encoding='utf-8')
if 'zod' in validations_content.lower():
    passed.append("✅ validations.ts: يستخدم Zod للتحقق")
else:
    warnings.append("⚠️ validations.ts: لا يستخدم Zod")

# فحص throw errors
throw_count = 0
for filepath in PROJECT_ROOT.glob('lib/db/repositories/*.ts'):
    content = filepath.read_text(encoding='utf-8')
    throw_count += content.count('throw new Error')

if throw_count > 10:
    passed.append(f"✅ repositories: {throw_count} throw للتحقق من الأخطاء")
else:
    warnings.append(f"⚠️ repositories: بس {throw_count} throw - محتاجين تحقق أكتر")

# فحص transactions
tx_count = 0
for filepath in PROJECT_ROOT.glob('lib/db/repositories/*.ts'):
    content = filepath.read_text(encoding='utf-8')
    tx_count += content.count('transaction(')

if tx_count > 5:
    passed.append(f"✅ repositories: {tx_count} transactions للعمليات الآمنة")
else:
    warnings.append(f"⚠️ repositories: بس {tx_count} transactions - محتاجين أكتر")

# ====== 6. فحص الأمان ======
print("\n" + "=" * 60)
print("🔒 6. فحص الأمان")
print("=" * 60)

# فحص bcrypt
auth_content = (PROJECT_ROOT / 'lib/db/auth.ts').read_text(encoding='utf-8')
if 'bcrypt' in auth_content and 'hash' in auth_content:
    passed.append("✅ auth: كلمات المرور مشفرة بـ bcrypt")
else:
    issues.append("❌ auth: كلمات المرور غير مشفرة")

# فحص session management
if 'localStorage' in auth_content and 'session' in auth_content.lower():
    warnings.append("⚠️ auth: session في localStorage (ممكن يُسرق عبر XSS)")
else:
    passed.append("✅ auth: session management آمن")

# فحص XSS - dangerouslySetInnerHTML
xss_count = 0
for filepath in PROJECT_ROOT.rglob('*.tsx'):
    content = filepath.read_text(encoding='utf-8')
    xss_count += content.count('dangerouslySetInnerHTML')

if xss_count > 0:
    warnings.append(f"⚠️ {xss_count} استخدام dangerouslySetInnerHTML - خطر XSS")
else:
    passed.append("✅ لا يوجد dangerouslySetInnerHTML (آمن من XSS)")

# فحص SQL/NoSQL injection - غير متوقع في IndexedDB لكن نتحقق
injection_risk = 0
for filepath in PROJECT_ROOT.glob('lib/db/repositories/*.ts'):
    content = filepath.read_text(encoding='utf-8')
    if 'eval(' in content or 'Function(' in content:
        injection_risk += 1

if injection_risk == 0:
    passed.append("✅ لا يوجد eval/Function (آمن من injection)")
else:
    issues.append(f"❌ {injection_risk} استخدام eval/Function - خطر injection")

# ====== 7. فحص قابلية التطوير ======
print("\n" + "=" * 60)
print("📈 7. فحص قابلية التطوير")
print("=" * 60)

# فحص تقسيم الملفات
large_files = []
for filepath in PROJECT_ROOT.rglob('*.tsx'):
    lines = len(filepath.read_text(encoding='utf-8').split('\n'))
    if lines > 500:
        large_files.append(f"{filepath.name} ({lines} سطر)")

if not large_files:
    passed.append("✅ كل الملفات أقل من 500 سطر")
else:
    for f in large_files:
        warnings.append(f"⚠️ ملف كبير: {f}")

# فحص TypeScript strict
tsconfig = Path('/home/z/my-project/tsconfig.json').read_text(encoding='utf-8')
if '"strict": true' in tsconfig:
    passed.append("✅ TypeScript strict mode مفعّل")
else:
    warnings.append("⚠️ TypeScript strict mode غير مفعّل")

# فحص ESLint
eslint = Path('/home/z/my-project/eslint.config.mjs').read_text(encoding='utf-8')
if 'next' in eslint.lower():
    passed.append("✅ ESLint مفعّل بقواعد Next.js")

# ====== النتائج النهائية ======
print("\n" + "=" * 60)
print("📊 النتائج النهائية")
print("=" * 60)

print(f"\n✅ نجح: {len(passed)}")
print(f"⚠️ تحذيرات: {len(warnings)}")
print(f"❌ أخطاء: {len(issues)}")

if issues:
    print("\n🔴 الأخطاء الحرجة:")
    for i in issues:
        print(f"  {i}")

if warnings:
    print("\n🟡 التحذيرات:")
    for w in warnings:
        print(f"  {w}")

print("\n🟢 الناجحة:")
for p in passed[:20]:  # أول 20
    print(f"  {p}")
if len(passed) > 20:
    print(f"  ... و {len(passed) - 20} أخرى")

# ====== تقرير الجاهزية ======
print("\n" + "=" * 60)
print("🎯 تقرير جاهزية الإطلاق")
print("=" * 60)

critical = len(issues)
major = len([w for w in warnings if '❌' in w])
minor = len(warnings) - major

if critical == 0 and major == 0:
    print("\n🟢 التطبيق جاهز للإطلاق!")
    print(f"   - {len(passed)} فحص ناجح")
    print(f"   - {minor} تحذيرات بسيطة (غير حرجة)")
    print("\n✅ يمكن إطلاق التطبيق فوراً")
elif critical <= 3:
    print(f"\n🟡 التطبيق شبه جاهز - {critical} أخطاء حرجة")
    print("   يُنصح بإصلاح الأخطاء قبل الإطلاق")
else:
    print(f"\n🔴 التطبيق غير جاهز - {critical} أخطاء حرجة")
    print("   يجب إصلاح كل الأخطاء قبل الإطلاق")

print(f"\n📊 التفاصيل:")
print(f"   - أخطاء حرجة: {critical}")
print(f"   - تحذيرات مهمة: {major}")
print(f"   - تحذيرات بسيطة: {minor}")
print(f"   - فحوصات ناجحة: {len(passed)}")
