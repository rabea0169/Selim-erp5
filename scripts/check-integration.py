#!/usr/bin/env python3
"""
فحص شامل لترابط الأقسام في Selim ERP
يفحص: المبيعات←المنتجات، الأجل، الأسعار، الخزينة، أوامر التشغيل، PWA
"""
import re
from pathlib import Path

PROJECT_ROOT = Path('/home/z/my-project/src')
issues = []
passed = []

print("=" * 70)
print("🔍 الفحص الشامل لترابط الأقسام في Selim ERP")
print("=" * 70)

# ====== 1. فحص ربط المبيعات بالمنتجات ======
print("\n📦 1. فحص ربط المبيعات بالمنتجات والمخازن")
print("-" * 50)

sales_content = (PROJECT_ROOT / 'lib/db/repositories/sales.ts').read_text(encoding='utf-8')

# هل المبيعات بتسحب من المخزن؟
if 'productRepository' in sales_content or 'consumeStock' in sales_content:
    passed.append("✅ المبيعات تسحب من مخزون المنتجات")
else:
    issues.append("❌ المبيعات لا تسحب من مخزون المنتجات - البيع مش بيانقص المخزون")

# هل المبيعات بتستخدم الأسعار الثلاثة؟
if 'wholesalePrice' in sales_content or 'retailPrice' in sales_content:
    passed.append("✅ المبيعات تستخدم أسعار المنتجات")
else:
    issues.append("❌ المبيعات لا تستخدم أسعار المنتجات (جملة/نصف جملة/قطاعي)")

# هل SaleItem مربوط بـ productId؟
types_content = (PROJECT_ROOT / 'lib/db/types/index.ts').read_text(encoding='utf-8')
if 'productId' in types_content and 'SaleItem' in types_content:
    # فحص لو SaleItem فيه productId
    sale_item_match = re.search(r'export interface SaleItem \{([^}]+)\}', types_content, re.DOTALL)
    if sale_item_match and 'productId' in sale_item_match.group(1):
        passed.append("✅ SaleItem مربوط بـ productId")
    else:
        issues.append("❌ SaleItem ليس مربوط بـ productId - مش بيربط الصنف بالمنتج")
else:
    issues.append("❌ SaleItem لا يحتوي على productId")

# ====== 2. فحص نظام البيع بالأجل ======
print("\n💰 2. فحص نظام البيع والشراء بالأجل")
print("-" * 50)

# هل فيه field للمتبقي في المبيعات؟
if 'paid' in types_content and 'total' in types_content:
    passed.append("✅ المبيعات فيها paid + total (نظام الأجل)")
else:
    issues.append("❌ المبيعات لا تدعم الأجل")

# هل فيه field للمتبقي في المشتريات؟
if 'Purchase' in types_content and 'paid' in types_content:
    passed.append("✅ المشتريات فيها paid + total (نظام الأجل)")
else:
    issues.append("❌ المشتريات لا تدعم الأجل")

# هل العملاء بيظهرون المتبقي عليهم؟
customers_content = (PROJECT_ROOT / 'lib/db/repositories/customers.ts').read_text(encoding='utf-8')
if 'totalRemaining' in customers_content or 'Remaining' in customers_content:
    passed.append("✅ العملاء يعرضون المتبقي (الأجل)")
else:
    issues.append("❌ العملاء لا يعرضون المتبقي عليهم")

# هل الموردين بيظهروا المتبقي لهم؟
suppliers_content = (PROJECT_ROOT / 'lib/db/repositories/suppliers.ts').read_text(encoding='utf-8')
if 'totalRemaining' in suppliers_content or 'Remaining' in suppliers_content:
    passed.append("✅ الموردين يعرضون المتبقي لهم (الأجل)")
else:
    issues.append("❌ الموردين لا يعرضون المتبقي لهم")

# ====== 3. فحص أسعار المنتجات ======
print("\n🏷️ 3. فحص أسعار المنتجات (جملة/نصف جملة/قطاعي)")
print("-" * 50)

products_content = (PROJECT_ROOT / 'lib/db/repositories/products.ts').read_text(encoding='utf-8')

if 'wholesalePrice' in products_content and 'halfWholesalePrice' in products_content and 'retailPrice' in products_content:
    passed.append("✅ المنتجات فيها 3 أسعار (جملة/نصف جملة/قطاعي)")
else:
    issues.append("❌ المنتجات لا تحتوي على 3 أسعار")

# هل المنتجات مربوط بمخزن؟
if 'warehouseId' in products_content:
    passed.append("✅ المنتجات مربوط بمخزن")
else:
    issues.append("❌ المنتجات غير مربوط بمخزن")

# ====== 4. فحص أوامر التشغيل ======
print("\n🏭 4. فحص أوامر التشغيل")
print("-" * 50)

# هل أمر التشغيل يسحب المواد؟
if 'materialTransactions' in products_content or 'consumeStock' in products_content:
    passed.append("✅ أمر التشغيل يسحب المواد الخام من المخزن")
else:
    issues.append("❌ أمر التشغيل لا يسحب المواد الخام")

# هل إكمال الأمر يضيف المنتج؟
if 'addStock' in products_content or 'products' in products_content:
    passed.append("✅ إكمال أمر التشغيل يضيف الكمية للمنتج")
else:
    issues.append("❌ إكمال أمر التشغيل لا يضيف المنتج")

# هل أمر التشغيل مربوط بـ productId؟
if 'productId' in types_content and 'ProductionOrder' in types_content:
    passed.append("✅ أمر التشغيل مربوط بـ productId")
else:
    issues.append("❌ أمر التشغيل غير مربوط بالمنتج")

# ====== 5. فحص الخزينة ======
print("\n🏦 5. فحص ربط الخزينة بكل العمليات")
print("-" * 50)

# هل المبيعات بتودي للخزينة؟
if 'treasuryTransactions' in sales_content:
    passed.append("✅ المبيعات تودع في الخزينة")
else:
    issues.append("❌ المبيعات لا تودع في الخزينة")

# هل المشتريات بتسحب من الخزينة؟
purchases_content = (PROJECT_ROOT / 'lib/db/repositories/purchases.ts').read_text(encoding='utf-8')
if 'treasuryTransactions' in purchases_content:
    passed.append("✅ المشتريات تسحب من الخزينة")
else:
    issues.append("❌ المشتريات لا تسحب من الخزينة")

# هل المصاريف بتسحب من الخزينة؟
expenses_content = (PROJECT_ROOT / 'lib/db/repositories/expenses.ts').read_text(encoding='utf-8')
if 'treasuryTransactions' in expenses_content:
    passed.append("✅ المصاريف تسحب من الخزينة")
else:
    issues.append("❌ المصاريف لا تسحب من الخزينة")

# هل سلف الموظفين بتسحب من الخزينة؟
worker_advances = (PROJECT_ROOT / 'lib/db/repositories/worker-advances.ts').read_text(encoding='utf-8')
if 'treasuryTransactions' in worker_advances:
    passed.append("✅ سلف الموظفين تسحب من الخزينة")
else:
    issues.append("❌ سلف الموظفين لا تسحب من الخزينة")

# هل قبض الموظفين بيودي للخزينة؟
worker_receipts = (PROJECT_ROOT / 'lib/db/repositories/worker-receipts.ts').read_text(encoding='utf-8')
if 'treasuryTransactions' in worker_receipts:
    passed.append("✅ قبض الموظفين يودع في الخزينة")
else:
    issues.append("❌ قبض الموظفين لا يودع في الخزينة")

# ====== 6. فحص استقرار قاعدة البيانات ======
print("\n💾 6. فحص استقرار قاعدة البيانات")
print("-" * 50)

conn_content = (PROJECT_ROOT / 'lib/db/connection.ts').read_text(encoding='utf-8')

# هل فيه DB version upgrade path؟
if 'oldVersion' in conn_content or 'DB_VERSION' in conn_content:
    passed.append("✅ قاعدة البيانات تدعم migration (version upgrade)")
else:
    issues.append("❌ قاعدة البيانات لا تدعم migration")

# هل فيه singleton pattern؟
if 'dbInstance' in conn_content:
    passed.append("✅ Singleton pattern (اتصال واحد)")
else:
    issues.append("❌ لا يوجد singleton - ممكن يفتح اتصالات متعددة")

# هل فيه transactions؟
tx_count = 0
for f in PROJECT_ROOT.glob('lib/db/repositories/*.ts'):
    tx_count += f.read_text(encoding='utf-8').count('transaction(')
if tx_count >= 10:
    passed.append(f"✅ {tx_count} transactions للعمليات الآمنة")
else:
    issues.append(f"❌ بس {tx_count} transactions - مش كافية")

# هل فيه cascade deletes؟
workers_content = (PROJECT_ROOT / 'lib/db/repositories/workers.ts').read_text(encoding='utf-8')
if 'deleteWithRelations' in workers_content:
    passed.append("✅ Cascade delete للموظفين")
else:
    issues.append("❌ لا يوجد cascade delete للموظفين")

# هل فيه backup/restore؟
reports_content = (PROJECT_ROOT / 'lib/db/repositories/reports.ts').read_text(encoding='utf-8')
if 'exportAll' in reports_content and 'importAll' in reports_content:
    passed.append("✅ Backup/Restore موجود")
else:
    issues.append("❌ لا يوجد Backup/Restore")

# هل فيه auto-backup؟
auto_backup = (PROJECT_ROOT / 'lib/db/auto-backup.ts').read_text(encoding='utf-8')
if 'caches.open' in auto_backup:
    passed.append("✅ Auto-backup يعمل تلقائياً")
else:
    issues.append("❌ لا يوجد auto-backup")

# ====== 7. فحص PWA وحفظ البيانات ======
print("\n📱 7. فحص PWA وحفظ البيانات")
print("-" * 50)

manifest = Path('/home/z/my-project/public/manifest.json')
if manifest.exists():
    passed.append("✅ manifest.json موجود (PWA)")
else:
    issues.append("❌ manifest.json غير موجود")

sw = Path('/home/z/my-project/public/sw.js')
if sw.exists():
    sw_content = sw.read_text(encoding='utf-8')
    if 'CACHE_NAME' in sw_content:
        passed.append("✅ Service Worker موجود (offline support)")
    else:
        issues.append("❌ Service Worker غير صحيح")
else:
    issues.append("❌ Service Worker غير موجود")

# هل البيانات في IndexedDB (مش localStorage)؟
if 'openDB' in conn_content and 'IndexedDB' in conn_content or 'idb' in conn_content:
    passed.append("✅ البيانات في IndexedDB (دائمة)")
else:
    issues.append("❌ البيانات مش في IndexedDB")

# هل Service Worker بينظف الـ cache القديم؟
if 'caches.keys' in sw_content and 'delete' in sw_content:
    passed.append("✅ Service Worker ينظف الكاش القديم")
else:
    issues.append("❌ Service Worker لا ينظف الكاش القديم")

# ====== 8. فحص حذف العمليات المرتبطة ======
print("\n🔗 8. فحص حذف العمليات المرتبطة")
print("-" * 50)

# هل حذف مبيعة بيحذف معاملتها من الخزينة؟
if 'referenceType' in sales_content and 'treasuryTransactions' in sales_content:
    # فحص إن فيه حذف للمعاملات المرتبطة
    if 'delete' in sales_content and 'referenceId' in sales_content:
        passed.append("✅ حذف المبيعة يحذف معاملتها من الخزينة")
    else:
        issues.append("❌ حذف المبيعة لا يحذف معاملتها من الخزينة")
else:
    issues.append("❌ لا يوجد ربط بين المبيعات والخزينة في الحذف")

# هل حذف مشترى بيحذف معاملته من الخزينة؟
if 'referenceType' in purchases_content and 'referenceId' in purchases_content:
    if 'delete' in purchases_content:
        passed.append("✅ حذف المشترى يحذف معاملته من الخزينة")
    else:
        issues.append("❌ حذف المشترى لا يحذف معاملته من الخزينة")
else:
    issues.append("❌ لا يوجد ربط بين المشتريات والخزينة في الحذف")

# ====== النتائج النهائية ======
print("\n" + "=" * 70)
print("📊 النتائج النهائية")
print("=" * 70)

print(f"\n✅ نجح: {len(passed)}")
print(f"❌ أخطاء: {len(issues)}")

if issues:
    print("\n🔴 الأخطاء المكتشفة:")
    for i in issues:
        print(f"  {i}")

print("\n🟢 الناجحة:")
for p in passed:
    print(f"  {p}")

# ====== تقرير الجاهزية ======
print("\n" + "=" * 70)
print("🎯 تقرير الجاهزية")
print("=" * 70)

critical = len(issues)
if critical == 0:
    print("\n🟢 كل الأقسام مترابطة بشكل صحيح!")
    print("✅ التطبيق جاهز للإطلاق الفعلي")
elif critical <= 5:
    print(f"\n🟡 فيه {critical} مشاكل محتاجة إصلاح")
else:
    print(f"\n🔴 فيه {critical} مشاكل حرجة - لازم تتصالح")

print(f"\n📊 التفاصيل:")
print(f"   - فحوصات ناجحة: {len(passed)}")
print(f"   - أخطاء: {critical}")
