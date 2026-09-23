#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# update-version.sh  —  تحديث تلقائي لـ version.json
# منصة الخلية — أ/ إسلام عبدالواحد لتعليم الأحياء
# للاستخدام على Mac/Linux
#
# الاستخدام:
#   chmod +x update-version.sh
#   ./update-version.sh
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/version.json"
INDEX_FILE="$SCRIPT_DIR/index.html"
DASHBOARD_FILE="$SCRIPT_DIR/dashboard.html"
SW_FILE="$SCRIPT_DIR/sw.js"

# القيمة الحالية
OLD_VERSION="غير محدد"
if [ -f "$VERSION_FILE" ]; then
    OLD_VERSION=$(grep '"v"' "$VERSION_FILE" | sed 's/.*"v": "\(.*\)".*/\1/')
fi

# توليد نسخة جديدة تلقائياً من التاريخ والوقت الحالي
NEW_VERSION=$(date +"%Y%m%d-%H%M")

# كتابة version.json
printf '{\n  "v": "%s"\n}\n' "$NEW_VERSION" > "$VERSION_FILE"
echo "✅ تم تحديث version.json: $NEW_VERSION"

# تحديث ?v= في index.html تلقائياً
if [ -f "$INDEX_FILE" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/?v=[0-9]\{8\}-[0-9]\{4\}/?v=$NEW_VERSION/g" "$INDEX_FILE"
    else
        # Linux
        sed -i "s/?v=[0-9]\{8\}-[0-9]\{4\}/?v=$NEW_VERSION/g" "$INDEX_FILE"
    fi
    echo "✅ تم تحديث ?v= في index.html"
fi

# تحديث ?v= في dashboard.html تلقائياً (نفس نمط index.html)
if [ -f "$DASHBOARD_FILE" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/?v=[0-9]\{8\}-[0-9]\{4\}/?v=$NEW_VERSION/g" "$DASHBOARD_FILE"
    else
        sed -i "s/?v=[0-9]\{8\}-[0-9]\{4\}/?v=$NEW_VERSION/g" "$DASHBOARD_FILE"
    fi
    echo "✅ تم تحديث ?v= في dashboard.html"
fi

# تحديث رقم إصدار الـ Service Worker (PWA) — عشان المتصفح يكتشف
# التحديث فورًا (محتوى الملف بيتغيّر فعليًا مش بس اسم الكاش)
if [ -f "$SW_FILE" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/const APP_VERSION = '[0-9]\{8\}-[0-9]\{4\}'/const APP_VERSION = '$NEW_VERSION'/" "$SW_FILE"
    else
        sed -i "s/const APP_VERSION = '[0-9]\{8\}-[0-9]\{4\}'/const APP_VERSION = '$NEW_VERSION'/" "$SW_FILE"
    fi
    echo "✅ تم تحديث APP_VERSION في sw.js"
fi

echo ""
echo "==============================================="
echo "  النسخة القديمة : $OLD_VERSION"
echo "  النسخة الجديدة : $NEW_VERSION"
echo "==============================================="
echo ""
echo "  الخطوات التالية:"
echo "     1. ارفع جميع الملفات إلى Firebase"
echo "     2. cache-buster.js سيتعرف على التحديث تلقائياً"
echo "     3. sw.js (PWA) هياخد نفس رقم الإصدار الجديد تلقائيًا"
echo ""
