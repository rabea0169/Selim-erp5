#!/bin/bash
# سكريبت اختبار شامل للـ APIs
set -e
BASE_URL="http://localhost:3000"
TOTAL_PASS=0
TOTAL_FAIL=0

ok() {
  echo "✅ $1"
  TOTAL_PASS=$((TOTAL_PASS+1))
}

fail() {
  echo "❌ $1"
  TOTAL_FAIL=$((TOTAL_FAIL+1))
}

check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    ok "$name"
  else
    fail "$name (expected: $expected)"
  fi
}

echo "🚀 بدء الاختبار الشامل للـ APIs"
echo "================================"

# === 1. SEED ===
echo ""
echo "📦 [1] تهيئة فئات المصاريف"
SEED_RES=$(curl -s -X POST "$BASE_URL/api/seed")
check "تهيئة الفئات" "success" "$SEED_RES"

# === 2. CUSTOMERS ===
echo ""
echo "👥 [2] العملاء"
CUST_RES=$(curl -s -X POST "$BASE_URL/api/customers" -H "Content-Type: application/json" -d '{"name":"عميل اختبار 1","phone":"01011111111","address":"القاهرة"}')
check "إضافة عميل" "customer" "$CUST_RES"
CUST_ID=$(echo "$CUST_RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   - ID: $CUST_ID"

CUST_ERR=$(curl -s -X POST "$BASE_URL/api/customers" -H "Content-Type: application/json" -d '{"name":"","phone":""}')
check "رفض عميل بدون اسم" "اسم العميل مطلوب" "$CUST_ERR"

CUST_UPD=$(curl -s -X PUT "$BASE_URL/api/customers/$CUST_ID" -H "Content-Type: application/json" -d '{"name":"عميل محدث","phone":"01022222222","address":"الجيزة"}')
check "تعديل العميل" "customer" "$CUST_UPD"

# === 3. SUPPLIERS ===
echo ""
echo "🚚 [3] الموردين"
SUP_RES=$(curl -s -X POST "$BASE_URL/api/suppliers" -H "Content-Type: application/json" -d '{"name":"مورد اختبار 1","phone":"01111111111"}')
check "إضافة مورد" "supplier" "$SUP_RES"
SUP_ID=$(echo "$SUP_RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# === 4. WORKERS ===
echo ""
echo "👷 [4] العمال"
WORKER_RES=$(curl -s -X POST "$BASE_URL/api/workers" -H "Content-Type: application/json" -d '{"name":"عامل اختبار 1","phone":"01222222222","job":"خياط","type":"monthly"}')
check "إضافة عامل" "worker" "$WORKER_RES"
WORKER_ID=$(echo "$WORKER_RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# === 5. SALES ===
echo ""
echo "💰 [5] المبيعات - ربط مع العميل"
SALE_RES=$(curl -s -X POST "$BASE_URL/api/sales" -H "Content-Type: application/json" -d "{\"customerName\":\"عميل محدث\",\"customerId_ref\":\"$CUST_ID\",\"date\":\"2026-07-24\",\"paid\":1000,\"items\":[{\"itemName\":\"تيشيرت\",\"quantity\":10,\"unitPrice\":150}]}")
check "إضافة فاتورة مبيعات" "sale" "$SALE_RES"
SALE_ID=$(echo "$SALE_RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

SALE_TOTAL=$(echo "$SALE_RES" | grep -o '"total":[0-9.]*' | head -1 | cut -d: -f2)
if [ "$SALE_TOTAL" = "1500" ]; then
  ok "حساب إجمالي البيع (10×150=1500)"
else
  fail "حساب إجمالي البيع (expected: 1500, got: $SALE_TOTAL)"
fi

SALE_ERR=$(curl -s -X POST "$BASE_URL/api/sales" -H "Content-Type: application/json" -d '{"customerName":"test","date":"2026-07-24","items":[]}')
check "رفض بيع بدون أصناف" "يجب إضافة صنف" "$SALE_ERR"

# === 6. PURCHASES ===
echo ""
echo "📦 [6] المشتريات - ربط مع المورد"
PUR_RES=$(curl -s -X POST "$BASE_URL/api/purchases" -H "Content-Type: application/json" -d "{\"supplierName\":\"مورد اختبار 1\",\"supplierId_ref\":\"$SUP_ID\",\"date\":\"2026-07-24\",\"paid\":500,\"items\":[{\"itemName\":\"قماش\",\"quantity\":50,\"unitPrice\":30}]}")
check "إضافة فاتورة مشتريات" "purchase" "$PUR_RES"

PUR_TOTAL=$(echo "$PUR_RES" | grep -o '"total":[0-9.]*' | head -1 | cut -d: -f2)
if [ "$PUR_TOTAL" = "1500" ]; then
  ok "حساب إجمالي الشراء (50×30=1500)"
else
  fail "حساب إجمالي الشراء (expected: 1500, got: $PUR_TOTAL)"
fi

# === 7. WORKER ADVANCES & RECEIPTS ===
echo ""
echo "💵 [7] سلف وقبض العمال"
ADV_RES=$(curl -s -X POST "$BASE_URL/api/worker-advances" -H "Content-Type: application/json" -d "{\"workerId\":\"$WORKER_ID\",\"amount\":200,\"date\":\"2026-07-24\"}")
check "تسجيل سلفة" "advance" "$ADV_RES"

REC_RES=$(curl -s -X POST "$BASE_URL/api/worker-receipts" -H "Content-Type: application/json" -d "{\"workerId\":\"$WORKER_ID\",\"amount\":50,\"date\":\"2026-07-24\"}")
check "تسجيل قبض" "receipt" "$REC_RES"

ADV_ERR=$(curl -s -X POST "$BASE_URL/api/worker-advances" -H "Content-Type: application/json" -d '{"workerId":"invalid","amount":100,"date":"2026-07-24"}')
check "رفض سلفة لعامل غير موجود" "العامل غير موجود" "$ADV_ERR"

ADV_ERR2=$(curl -s -X POST "$BASE_URL/api/worker-advances" -H "Content-Type: application/json" -d "{\"workerId\":\"$WORKER_ID\",\"amount\":0,\"date\":\"2026-07-24\"}")
if echo "$ADV_ERR2" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'error' in d else 1)"; then
  ok "رفض سلفة بمبلغ صفر"
else
  fail "رفض سلفة بمبلغ صفر"
fi

# === 8. ATTENDANCE ===
echo ""
echo "⏰ [8] الحضور والانصراف"
ATT_RES=$(curl -s -X POST "$BASE_URL/api/attendance" -H "Content-Type: application/json" -d "{\"workerId\":\"$WORKER_ID\",\"date\":\"2026-07-24\",\"checkIn\":\"2026-07-24T08:00:00.000Z\",\"status\":\"present\"}")
check "تسجيل حضور" "attendance" "$ATT_RES"

ATT_UPD=$(curl -s -X POST "$BASE_URL/api/attendance" -H "Content-Type: application/json" -d "{\"workerId\":\"$WORKER_ID\",\"date\":\"2026-07-24\",\"checkOut\":\"2026-07-24T17:00:00.000Z\"}")
check "تسجيل انصراف (تحديث نفس اليوم)" "updated" "$ATT_UPD"

# === 9. PRODUCTION ===
echo ""
echo "✂️ [9] الإنتاج بالقطعة"
PROD_RES=$(curl -s -X POST "$BASE_URL/api/production" -H "Content-Type: application/json" -d "{\"workerId\":\"$WORKER_ID\",\"date\":\"2026-07-24\",\"modelName\":\"تيشيرت قطن\",\"quantity\":100,\"unitPrice\":5}")
check "تسجيل إنتاج" "production" "$PROD_RES"

PROD_TOTAL=$(echo "$PROD_RES" | grep -o '"total":[0-9.]*' | head -1 | cut -d: -f2)
if [ "$PROD_TOTAL" = "500" ]; then
  ok "حساب إجمالي الإنتاج (100×5=500)"
else
  fail "حساب إجمالي الإنتاج (expected: 500, got: $PROD_TOTAL)"
fi

# === 10. EXPENSES ===
echo ""
echo "💸 [10] المصاريف"
CAT_ID=$(curl -s "$BASE_URL/api/expense-categories" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
EXP_RES=$(curl -s -X POST "$BASE_URL/api/expenses" -H "Content-Type: application/json" -d "{\"categoryId\":\"$CAT_ID\",\"amount\":300,\"date\":\"2026-07-24\"}")
check "تسجيل مصروف" "expense" "$EXP_RES"

EXP_ERR=$(curl -s -X POST "$BASE_URL/api/expenses" -H "Content-Type: application/json" -d "{\"categoryId\":\"$CAT_ID\",\"amount\":-100,\"date\":\"2026-07-24\"}")
if echo "$EXP_ERR" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'error' in d else 1)"; then
  ok "رفض مصروف بمبلغ سالب"
else
  fail "رفض مصروف بمبلغ سالب"
fi

# === 11. REPORTS ===
echo ""
echo "📊 [11] التقارير"
REP_RES=$(curl -s "$BASE_URL/api/reports?from=2026-07-01&to=2026-07-31")
check "تقرير شامل" "summary" "$REP_RES"
check "وجود مبيعات في التقرير" "salesTotal" "$REP_RES"
check "وجود إنتاج في التقرير" "productionTotal" "$REP_RES"

# === 12. INDIVIDUAL REPORTS ===
echo ""
echo "📋 [12] التقارير الفردية"
WREP_RES=$(curl -s "$BASE_URL/api/worker-report/$WORKER_ID?from=2026-07-01&to=2026-07-31")
check "تقرير العامل" "totalAdvances" "$WREP_RES"
check "وجود الإنتاج في تقرير العامل" "totalProduction" "$WREP_RES"

CREP_RES=$(curl -s "$BASE_URL/api/customer-report/$CUST_ID?from=2026-07-01&to=2026-07-31")
check "تقرير العميل" "totalSales" "$CREP_RES"

SREP_RES=$(curl -s "$BASE_URL/api/supplier-report/$SUP_ID?from=2026-07-01&to=2026-07-31")
check "تقرير المورد" "totalPurchases" "$SREP_RES"

# === 13. BACKUP ===
echo ""
echo "💾 [13] النسخ الاحتياطي"
BACKUP_RES=$(curl -s "$BASE_URL/api/backup")
check "نسخة احتياطية" "data" "$BACKUP_RES"

for table in workers customers suppliers sales saleItems purchases purchaseItems expenses expenseCategories workerAdvances workerReceipts workerAttendance production; do
  if echo "$BACKUP_RES" | grep -q "\"$table\""; then
    ok "وجود $table في النسخة"
  else
    fail "غياب $table من النسخة"
  fi
done

# === 14. CASCADE DELETE ===
echo ""
echo "🔗 [14] الحذف المتسلسل (Cascade)"
DEL_RES=$(curl -s -X DELETE "$BASE_URL/api/workers/$WORKER_ID")
check "حذف العامل" "success" "$DEL_RES"

ADV_LEFT=$(curl -s "$BASE_URL/api/worker-advances?workerId=$WORKER_ID" | grep -o '"id":"[^"]*"' | wc -l)
if [ "$ADV_LEFT" = "0" ]; then
  ok "حذف السلف تلقائياً مع العامل"
else
  fail "لم تُحذف السلف مع العامل"
fi

# === 15. CUSTOMER LINK PRESERVATION ===
echo ""
echo "🔗 [15] حفظ اسم العميل عند حذفه"
SALE_CHECK=$(curl -s "$BASE_URL/api/sales")
if echo "$SALE_CHECK" | grep -q "عميل محدث"; then
  ok "حفظ اسم العميل في الفاتورة بعد حذف العميل"
else
  fail "لم يتم حفظ اسم العميل بعد الحذف"
fi

# === 16. RESTORE ===
echo ""
echo "♻️ [16] استرجاع النسخة الاحتياطية"
BACKUP_DATA=$(echo "$BACKUP_RES" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps({"data": d["data"]}))')
RESTORE_RES=$(curl -s -X POST "$BASE_URL/api/restore" -H "Content-Type: application/json" -d "$BACKUP_DATA")
check "استرجاع البيانات" "success" "$RESTORE_RES"

WORKER_CHECK=$(curl -s "$BASE_URL/api/workers" | grep -o '"name":"عامل اختبار 1"')
if [ -n "$WORKER_CHECK" ]; then
  ok "استرجاع العامل المحذوف"
else
  fail "لم يتم استرجاع العامل"
fi

# === النتيجة النهائية ===
echo ""
echo "================================"
echo "🏁 النتيجة النهائية:"
echo "   ✅ نجح: $TOTAL_PASS"
echo "   ❌ فشل: $TOTAL_FAIL"
echo "   المجموع: $((TOTAL_PASS+TOTAL_FAIL))"
if [ "$TOTAL_FAIL" = "0" ]; then
  echo ""
  echo "🎉 جميع الاختبارات نجحت!"
  exit 0
else
  echo ""
  echo "⚠️ يوجد اختبارات فشلت"
  exit 1
fi
