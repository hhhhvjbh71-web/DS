// ═══════════════════════════════════════════════════════════════════════
//  cache-buster.js — نظام تحديث Cache محسّن
//  منصة الخلية — أ/ إسلام عبدالواحد لتعليم الأحياء
//  الإصدار: 2.0.0
// ═══════════════════════════════════════════════════════════════════════
//
//  آلية العمل:
//  1. يجلب version.json من السيرفر (بدون أي Cache نهائياً).
//  2. يقارن الإصدار الجديد بالمحفوظ في localStorage.
//  3. إذا كان هناك تحديث:
//     أ. يمسح Cache Storage بالكامل (Cache API + Service Workers).
//     ب. يُعيد تحميل الصفحة مع ?v=جديد لإجبار المتصفح على جلب الملفات.
//  4. إذا لا يوجد تحديث → لا يفعل شيئاً.
//
//  طريقة التحديث عند رفع ملفات جديدة:
//  بعد كل رفع، حدّث ملف "version.json":
//  { "v": "20260821-1430" }   ← تاريخ ووقت الرفع (YYYYMMDD-HHMM)
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    var VERSION_FILE = 'version.json';
    var STORAGE_KEY = 'iraqi_site_version';
    var LAST_CHECK_KEY = 'iraqi_last_version_check';
    var CHECK_INTERVAL = 2 * 60 * 1000;   // كل دقيقتين
    var MIN_CHECK_GAP  = 30 * 1000;        // 30 ثانية بحد أدنى بين كل فحص

    function fetchServerVersion(callback) {
        var url = VERSION_FILE + '?_nc=' + Date.now() + '&r=' + Math.random().toString(36).slice(2);
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        xhr.setRequestHeader('Pragma', 'no-cache');
        xhr.setRequestHeader('Expires', '0');
        xhr.timeout = 8000;
        xhr.onload = function () {
            if (xhr.status === 200) {
                try { callback(null, JSON.parse(xhr.responseText).v || null); }
                catch (e) { callback('JSON parse error', null); }
            } else { callback('HTTP ' + xhr.status, null); }
        };
        xhr.onerror = function () { callback('Network error', null); };
        xhr.ontimeout = function () { callback('Timeout', null); };
        try { xhr.send(); } catch (e) { callback(e.message, null); }
    }

    function clearAllCaches(onDone) {
        var tasks = [];
        if (window.caches) {
            tasks.push(window.caches.keys().then(function (names) {
                return Promise.all(names.map(function (n) { return window.caches.delete(n); }));
            }).catch(function () { }));
        }
        if ('serviceWorker' in navigator) {
            tasks.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
                return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
            }).catch(function () { }));
        }
        tasks.length > 0 ? Promise.all(tasks).then(onDone).catch(onDone) : onDone();
    }

    function reloadPage(newVersion) {
        var base = window.location.origin + window.location.pathname;
        var hash = window.location.hash || '';
        window.location.replace(base + '?v=' + encodeURIComponent(newVersion) + hash);
    }

    function hardReload(newVersion) {
        console.log('[CacheBuster] تحديث جديد:', newVersion, '— جاري مسح الـ Cache وإعادة التحميل...');
        try {
            localStorage.setItem(STORAGE_KEY, newVersion);
            localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
        } catch (e) { }

        // امسح الـ Cache Storage وService Workers، ثم أعد التحميل الكامل
        clearAllCaches(function () {
            // location.reload(true) يجبر المتصفح على جلب كل الملفات من السيرفر
            // بما فيها JS وCSS — بدون أي cache
            try {
                window.location.reload(true);
            } catch (e) {
                // fallback لو reload(true) مش مدعوم
                var base = window.location.origin + window.location.pathname;
                window.location.replace(base + '?bust=' + Date.now());
            }
        });
    }

    function checkForUpdates(isPeriodicCheck) {
        if (isPeriodicCheck) {
            try {
                var lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10);
                if (Date.now() - lastCheck < MIN_CHECK_GAP) return;
            } catch (e) { }
        }
        fetchServerVersion(function (err, serverVersion) {
            if (err || !serverVersion) {
                console.warn('[CacheBuster] تعذّر فحص الإصدار:', err);
                return;
            }
            var localVersion;
            try { localVersion = localStorage.getItem(STORAGE_KEY); } catch (e) { }

            if (!localVersion) {
                try {
                    localStorage.setItem(STORAGE_KEY, serverVersion);
                    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
                } catch (e) { }
                console.log('[CacheBuster] أول زيارة — إصدار مسجّل:', serverVersion);
            } else if (localVersion !== serverVersion) {
                hardReload(serverVersion);
            } else {
                try { localStorage.setItem(LAST_CHECK_KEY, Date.now().toString()); } catch (e) { }
                console.log('[CacheBuster] الإصدار محدَّث:', serverVersion);
            }
        });
    }

    // التشغيل الأولي
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { checkForUpdates(false); });
    } else {
        checkForUpdates(false);
    }

    // فحص دوري
    setInterval(function () { checkForUpdates(true); }, CHECK_INTERVAL);

    // فحص عند العودة للتبويب
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) checkForUpdates(true);
    });

    // فحص عند استعادة الإنترنت
    window.addEventListener('online', function () {
        setTimeout(function () { checkForUpdates(false); }, 1000);
    });

    // API خارجي
    window.CacheBuster = {
        check: function () { checkForUpdates(false); },
        clearVersion: function () {
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(LAST_CHECK_KEY);
            } catch (e) { }
        },
        getVersion: function () {
            try { return localStorage.getItem(STORAGE_KEY) || 'غير محدد'; } catch (e) { return 'خطأ'; }
        },
        forceReload: function () {
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(LAST_CHECK_KEY);
            } catch (e) { }
            clearAllCaches(function () { window.location.reload(true); });
        }
    };

})();
