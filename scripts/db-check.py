#!/usr/bin/env python3
"""فحص شامل لقاعدة البيانات"""
import sqlite3
import sys

DB_PATH = '/home/z/my-project/db/custom.db'

def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    print("=" * 60)
    print("🔍 الفحص الشامل لقاعدة البيانات")
    print("=" * 60)

    # 1. فحص الجداول الموجودة
    print("\n📦 [1] الجداول الموجودة:")
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name")
    tables = [r[0] for r in c.fetchall()]
    expected_tables = [
        'User', 'Worker', 'WorkerAdvance', 'WorkerReceipt', 'WorkerAttendance',
        'Production', 'Customer', 'Supplier', 'Sale', 'SaleItem',
        'Purchase', 'PurchaseItem', 'ExpenseCategory', 'Expense'
    ]
    for t in expected_tables:
        if t in tables:
            c.execute(f"SELECT COUNT(*) FROM {t}")
            count = c.fetchone()[0]
            print(f"  ✅ {t}: {count} سجل")
        else:
            print(f"  ❌ {t}: مفقود!")

    # 2. فحص الفهارس (Indexes)
    print("\n📇 [2] الفهارس (Indexes):")
    c.execute("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name")
    indexes = c.fetchall()
    print(f"  عدد الفهارس: {len(indexes)}")
    for idx_name, tbl in indexes:
        print(f"  ✅ {tbl}.{idx_name}")

    # 3. فحص سلامة المفاتيح الأجنبية
    print("\n🔗 [3] سلامة المفاتيح الأجنبية:")
    checks = [
        ("WorkerAdvance", "workerId", "Worker", "id"),
        ("WorkerReceipt", "workerId", "Worker", "id"),
        ("WorkerAttendance", "workerId", "Worker", "id"),
        ("Production", "workerId", "Worker", "id"),
        ("SaleItem", "saleId", "Sale", "id"),
        ("PurchaseItem", "purchaseId", "Purchase", "id"),
        ("Expense", "categoryId", "ExpenseCategory", "id"),
    ]
    for child_table, child_col, parent_table, parent_col in checks:
        c.execute(f"""
            SELECT COUNT(*) FROM {child_table}
            WHERE {child_col} NOT IN (SELECT {parent_col} FROM {parent_table})
        """)
        orphan = c.fetchone()[0]
        status = "✅" if orphan == 0 else "❌"
        print(f"  {status} {child_table}.{child_col} → {parent_table}.{parent_col}: {orphan} يتيم")

    # فحص العلاقات الاختيارية (SetNull)
    c.execute("SELECT COUNT(*) FROM Sale WHERE customerId_ref IS NOT NULL AND customerId_ref NOT IN (SELECT id FROM Customer)")
    orphan = c.fetchone()[0]
    status = "✅" if orphan == 0 else "❌"
    print(f"  {status} Sale.customerId_ref → Customer.id: {orphan} يتيم")

    c.execute("SELECT COUNT(*) FROM Purchase WHERE supplierId_ref IS NOT NULL AND supplierId_ref NOT IN (SELECT id FROM Supplier)")
    orphan = c.fetchone()[0]
    status = "✅" if orphan == 0 else "❌"
    print(f"  {status} Purchase.supplierId_ref → Supplier.id: {orphan} يتيم")

    # 4. فحص تكامل البيانات
    print("\n📊 [4] تكامل البيانات:")

    # فحص المستخدمين
    c.execute("SELECT COUNT(*) FROM User")
    user_count = c.fetchone()[0]
    print(f"  👤 المستخدمون: {user_count}")
    if user_count > 0:
        c.execute("SELECT username, name, role FROM User")
        for u in c.fetchall():
            print(f"     - {u[0]} ({u[1]}) - دور: {u[2]}")

    # فحص إجمالي البيانات
    c.execute("SELECT COUNT(*) FROM Worker")
    workers = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM Customer")
    customers = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM Supplier")
    suppliers = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM Sale")
    sales = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM Purchase")
    purchases = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM Expense")
    expenses = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM ExpenseCategory")
    categories = c.fetchone()[0]

    print(f"\n  📈 ملخص البيانات:")
    print(f"     - عمال: {workers}")
    print(f"     - عملاء: {customers}")
    print(f"     - موردين: {suppliers}")
    print(f"     - مبيعات: {sales}")
    print(f"     - مشتريات: {purchases}")
    print(f"     - مصاريف: {expenses}")
    print(f"     - بنود مصاريف: {categories}")

    # 5. فحص القيود (Constraints)
    print("\n⚠️ [5] فحص القيود:")

    # قيم سالبة في المبالغ
    c.execute("SELECT COUNT(*) FROM WorkerAdvance WHERE amount <= 0")
    bad = c.fetchone()[0]
    print(f"  {'✅' if bad == 0 else '❌'} سلف بمبلغ غير موجب: {bad}")

    c.execute("SELECT COUNT(*) FROM WorkerReceipt WHERE amount <= 0")
    bad = c.fetchone()[0]
    print(f"  {'✅' if bad == 0 else '❌'} قبض بمبلغ غير موجب: {bad}")

    c.execute("SELECT COUNT(*) FROM Expense WHERE amount <= 0")
    bad = c.fetchone()[0]
    print(f"  {'✅' if bad == 0 else '❌'} مصاريف بمبلغ غير موجب: {bad}")

    c.execute("SELECT COUNT(*) FROM Production WHERE quantity <= 0 OR unitPrice < 0")
    bad = c.fetchone()[0]
    print(f"  {'✅' if bad == 0 else '❌'} إنتاج بكمية/سعر غير صحيح: {bad}")

    # قيم فارغة في الأسماء
    c.execute("SELECT COUNT(*) FROM Worker WHERE name IS NULL OR name = ''")
    bad = c.fetchone()[0]
    print(f"  {'✅' if bad == 0 else '❌'} عمال بدون اسم: {bad}")

    c.execute("SELECT COUNT(*) FROM Customer WHERE name IS NULL OR name = ''")
    bad = c.fetchone()[0]
    print(f"  {'✅' if bad == 0 else '❌'} عملاء بدون اسم: {bad}")

    c.execute("SELECT COUNT(*) FROM Sale WHERE customerName IS NULL OR customerName = ''")
    bad = c.fetchone()[0]
    print(f"  {'✅' if bad == 0 else '❌'} مبيعات بدون اسم عميل: {bad}")

    # 6. فحص صحة حسابات الفواتير
    print("\n🧮 [6] صحة حسابات الفواتير:")

    # فحص تطابق إجمالي Sale مع مجموع أصنافها
    c.execute("""
        SELECT s.id, s.total, COALESCE(SUM(si.total), 0) as items_total
        FROM Sale s
        LEFT JOIN SaleItem si ON si.saleId = s.id
        GROUP BY s.id
        HAVING ABS(s.total - items_total) > 0.01
    """)
    mismatches = c.fetchall()
    print(f"  {'✅' if not mismatches else '❌'} تطابق إجمالي المبيعات مع الأصناف: {len(mismatches)} اختلاف")

    c.execute("""
        SELECT p.id, p.total, COALESCE(SUM(pi.total), 0) as items_total
        FROM Purchase p
        LEFT JOIN PurchaseItem pi ON pi.purchaseId = p.id
        GROUP BY p.id
        HAVING ABS(p.total - items_total) > 0.01
    """)
    mismatches = c.fetchall()
    print(f"  {'✅' if not mismatches else '❌'} تطابق إجمالي المشتريات مع الأصناف: {len(mismatches)} اختلاف")

    # 7. فحص قيم الحضور
    print("\n⏰ [7] قيم الحضور:")
    c.execute("SELECT DISTINCT status FROM WorkerAttendance")
    statuses = [r[0] for r in c.fetchall()]
    valid_statuses = {'present', 'absent', 'leave'}
    invalid = [s for s in statuses if s not in valid_statuses]
    print(f"  {'✅' if not invalid else '❌'} قيم الحضور صحيحة: {statuses}")
    if invalid:
        print(f"     قيم غير صحيحة: {invalid}")

    # فحص نوع العامل
    c.execute("SELECT DISTINCT type FROM Worker")
    types = [r[0] for r in c.fetchall()]
    valid_types = {'monthly', 'production'}
    invalid = [t for t in types if t not in valid_types]
    print(f"  {'✅' if not invalid else '❌'} أنواع العمال صحيحة: {types}")

    # 8. فحص PRAGMA integrity_check
    print("\n🔧 [8] فحص سلامة SQLite:")
    c.execute("PRAGMA integrity_check")
    result = c.fetchone()[0]
    print(f"  {'✅' if result == 'ok' else '❌'} integrity_check: {result}")

    c.execute("PRAGMA foreign_key_check")
    fk_issues = c.fetchall()
    print(f"  {'✅' if not fk_issues else '❌'} foreign_key_check: {len(fk_issues)} مشكلة")

    # 9. حجم قاعدة البيانات
    print("\n💾 [9] معلومات قاعدة البيانات:")
    import os
    size = os.path.getsize(DB_PATH)
    print(f"  📁 الحجم: {size:,} bytes ({size/1024:.1f} KB)")

    conn.close()

    print("\n" + "=" * 60)
    print("✅ اكتمل الفحص الشامل!")
    print("=" * 60)


if __name__ == '__main__':
    main()
