# ═══════════════════════════════════════════════════════════════
# update-version.ps1  —  تحديث تلقائي لـ version.json
# منصة الخلية — أ/ إسلام عبدالواحد لتعليم الأحياء
#
# الاستخدام:
#   .\update-version.ps1
#
# ما يفعله:
#   1. يُولِّد رقم نسخة جديدة بصيغة: YYYYMMDD-HHmm
#   2. يكتب الـ version.json بالقيمة الجديدة
#   3. يُحدِّث قيم ?v= في index.html تلقائياً
#   4. يُطبع النسخة القديمة والجديدة في الـ console
#
# بعد تشغيل هذا الـ script:
#   ارفع جميع الملفات — cache-buster.js سيتعرف على التحديث تلقائياً
# ═══════════════════════════════════════════════════════════════

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VersionFile     = Join-Path $ScriptDir "version.json"
$IndexFile       = Join-Path $ScriptDir "index.html"
$DashboardFile   = Join-Path $ScriptDir "dashboard.html"
$SwFile          = Join-Path $ScriptDir "sw.js"

# ── قراءة الـ version الحالية ─────────────────────────────────
$OldVersion = "غير محدد"
if (Test-Path $VersionFile) {
    try {
        $content = Get-Content $VersionFile -Raw -Encoding UTF8
        $json = $content | ConvertFrom-Json
        $OldVersion = $json.v
    } catch {
        Write-Warning "تعذّر قراءة version.json الحالي."
    }
}

# ── توليد الـ version الجديدة (تاريخ + وقت تلقائي) ──────────
$Now = Get-Date
$NewVersion = $Now.ToString("yyyyMMdd-HHmm")

# ── كتابة version.json ────────────────────────────────────────
$JsonContent = "{`n  `"v`": `"$NewVersion`"`n}`n"
[System.IO.File]::WriteAllText($VersionFile, $JsonContent, [System.Text.Encoding]::UTF8)

# ── تحديث ?v= في index.html تلقائياً ────────────────────────
if (Test-Path $IndexFile) {
    $indexContent = Get-Content $IndexFile -Raw -Encoding UTF8
    # استبدل أي ?v=XXXXXXXX-XXXX بالقيمة الجديدة
    $indexContent = $indexContent -replace '\?v=\d{8}-\d{4}', "?v=$NewVersion"
    [System.IO.File]::WriteAllText($IndexFile, $indexContent, [System.Text.Encoding]::UTF8)
    Write-Host "  تم تحديث ?v= في index.html" -ForegroundColor Green
}

# ── تحديث ?v= في dashboard.html تلقائياً (نفس نمط index.html) ─
if (Test-Path $DashboardFile) {
    $dashContent = Get-Content $DashboardFile -Raw -Encoding UTF8
    $dashContent = $dashContent -replace '\?v=\d{8}-\d{4}', "?v=$NewVersion"
    [System.IO.File]::WriteAllText($DashboardFile, $dashContent, [System.Text.Encoding]::UTF8)
    Write-Host "  تم تحديث ?v= في dashboard.html" -ForegroundColor Green
}

# ── تحديث رقم إصدار الـ Service Worker (PWA) ──────────────────
if (Test-Path $SwFile) {
    $swContent = Get-Content $SwFile -Raw -Encoding UTF8
    $swContent = $swContent -replace "const APP_VERSION = '\d{8}-\d{4}'", "const APP_VERSION = '$NewVersion'"
    [System.IO.File]::WriteAllText($SwFile, $swContent, [System.Text.Encoding]::UTF8)
    Write-Host "  تم تحديث APP_VERSION في sw.js" -ForegroundColor Green
}

# ── طباعة النتيجة ─────────────────────────────────────────────
Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  OK - تم تحديث النسخة بنجاح!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  النسخة القديمة : $OldVersion" -ForegroundColor Yellow
Write-Host "  النسخة الجديدة : $NewVersion" -ForegroundColor Green
Write-Host ""
Write-Host "  الخطوات التالية:" -ForegroundColor Cyan
Write-Host "     1. ارفع جميع الملفات المعدلة إلى Firebase" -ForegroundColor White
Write-Host "     2. version.json و index.html مُحدَّثان تلقائياً" -ForegroundColor White
Write-Host "     3. cache-buster.js سيتعرف على التحديث تلقائياً للمستخدمين" -ForegroundColor White
Write-Host ""
