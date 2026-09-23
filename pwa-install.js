// ═══════════════════════════════════════════════════════════════════════
//  pwa-install.js — تسجيل الـ Service Worker + نافذة تثبيت التطبيق (PWA)
//  منصة الخلية — أ/ إسلام عبدالواحد لتعليم الأحياء
//
//  ملاحظات مهمة:
//  • هذا الملف إضافة مستقلة بالكامل — مبيلمسش أي كود تسجيل دخول أو
//    Firebase أو أي وظيفة موجودة في المنصة.
//  • نافذة التثبيت بتظهر في كل صفحة (index.html / dashboard.html) طول
//    ما التطبيق لسه مش متثبّت، وبتختفي نهائيًا بعد نجاح التثبيت.
//  • مفيش أي localStorage بيتسجل فيه "تم الرفض" بشكل دائم — بس حالة
//    "تم التثبيت" هي اللي بتتسجل بشكل دائم (زي ما طلب العميل بالظبط).
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    var INSTALLED_FLAG_KEY = 'mag_pwa_installed';
    var deferredPrompt = null;
    var modalShownThisPageView = false;
    var modalEl = null;

    // ── 1) تسجيل الـ Service Worker ─────────────────────────────────
    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            }).then(function (reg) {
                console.log('[PWA] Service Worker registered:', reg.scope);
            }).catch(function (err) {
                console.warn('[PWA] Service Worker registration failed:', err);
            });
        });
    }

    // ── 2) هل التطبيق شغال فعلاً كـ PWA مثبّتة؟ ─────────────────────
    function isRunningStandalone() {
        var mql = window.matchMedia && window.matchMedia('(display-mode: standalone)');
        if (mql && mql.matches) return true;
        if (window.navigator && window.navigator.standalone === true) return true; // iOS Safari legacy
        return false;
    }

    function isAlreadyMarkedInstalled() {
        try { return localStorage.getItem(INSTALLED_FLAG_KEY) === '1'; }
        catch (e) { return false; }
    }

    function markInstalled() {
        try { localStorage.setItem(INSTALLED_FLAG_KEY, '1'); } catch (e) { }
    }

    // ── 3) كشف نوع الجهاز/المتصفح لاختيار طريقة العرض المناسبة ─────
    function detectPlatform() {
        var ua = navigator.userAgent || '';
        var isIOS = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        var isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
        var isMac = /Macintosh/.test(ua) && !isIOS;
        return {
            isIOS: isIOS,
            isIOSSafari: isIOS && isSafari,
            isMacSafari: isMac && isSafari
        };
    }

    // ── 4) بناء واجهة نافذة التثبيت ──────────────────────────────────
    function buildModal(mode) {
        var overlay = document.createElement('div');
        overlay.id = 'pwa-install-overlay';
        overlay.setAttribute('dir', 'rtl');
        overlay.setAttribute('lang', 'ar');

        var iconSrc = 'icons/icon-192.png';
        var stepsHtml = '';
        var actionHtml = '';

        if (mode === 'prompt') {
            actionHtml =
                '<button type="button" class="pwa-install-btn-primary" id="pwaInstallBtn">تثبيت التطبيق الآن</button>' +
                '<button type="button" class="pwa-install-btn-secondary" id="pwaInstallDismiss">ليس الآن</button>';
        } else if (mode === 'ios') {
            stepsHtml =
                '<div class="pwa-install-steps">' +
                    '<div class="pwa-install-step"><span class="pwa-install-step-num">1</span><span>اضغط على أيقونة المشاركة <strong>Share ⬆️</strong> في شريط Safari</span></div>' +
                    '<div class="pwa-install-step"><span class="pwa-install-step-num">2</span><span>اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong> Add to Home Screen</span></div>' +
                    '<div class="pwa-install-step"><span class="pwa-install-step-num">3</span><span>اضغط <strong>"إضافة"</strong> لتثبيت التطبيق</span></div>' +
                '</div>';
            actionHtml = '<button type="button" class="pwa-install-btn-secondary pwa-install-btn-full" id="pwaInstallDismiss">حسنًا، فهمت</button>';
        } else if (mode === 'mac') {
            stepsHtml =
                '<div class="pwa-install-steps">' +
                    '<div class="pwa-install-step"><span class="pwa-install-step-num">1</span><span>من قائمة <strong>مشاركة Share</strong> في متصفح Safari</span></div>' +
                    '<div class="pwa-install-step"><span class="pwa-install-step-num">2</span><span>اختر <strong>"إضافة إلى الرصيف"</strong> Add to Dock</span></div>' +
                '</div>';
            actionHtml = '<button type="button" class="pwa-install-btn-secondary pwa-install-btn-full" id="pwaInstallDismiss">حسنًا، فهمت</button>';
        }

        overlay.innerHTML =
            '<div class="pwa-install-sheet" role="dialog" aria-modal="true" aria-labelledby="pwaInstallTitle">' +
                '<button type="button" class="pwa-install-close" id="pwaInstallClose" aria-label="إغلاق">✕</button>' +
                '<img src="' + iconSrc + '" alt="أيقونة المنصة" class="pwa-install-icon">' +
                '<h2 id="pwaInstallTitle" class="pwa-install-title">📱 Install <span dir="ltr" style="unicode-bidi:isolate;">Mr. Islam Abdelwahed Platform</span></h2>' +
                '<p class="pwa-install-desc">استمتع بتجربة أسرع وأسهل من خلال تثبيت التطبيق على جهازك، والوصول إلى الدروس والاختبارات والواجبات بسهولة.</p>' +
                stepsHtml +
                '<div class="pwa-install-actions">' + actionHtml + '</div>' +
            '</div>';

        return overlay;
    }

    function closeModal() {
        if (!modalEl) return;
        modalEl.classList.add('pwa-install-hide');
        var el = modalEl;
        setTimeout(function () {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        }, 260);
        modalEl = null;
    }

    function showModal(mode) {
        if (modalShownThisPageView) return;
        if (isRunningStandalone() || isAlreadyMarkedInstalled()) return;

        modalShownThisPageView = true;
        modalEl = buildModal(mode);
        document.body.appendChild(modalEl);
        // إعادة تدفق قبل إضافة كلاس الظهور عشان الـ Animation يشتغل
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                modalEl.classList.add('pwa-install-show');
            });
        });

        var closeBtn = document.getElementById('pwaInstallClose');
        var dismissBtn = document.getElementById('pwaInstallDismiss');
        var installBtn = document.getElementById('pwaInstallBtn');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (dismissBtn) dismissBtn.addEventListener('click', closeModal);

        if (installBtn) {
            installBtn.addEventListener('click', function () {
                if (!deferredPrompt) { closeModal(); return; }
                installBtn.disabled = true;
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(function (choice) {
                    if (choice && choice.outcome === 'accepted') {
                        markInstalled();
                    }
                    deferredPrompt = null;
                    closeModal();
                }).catch(function () { closeModal(); });
            });
        }

        // إغلاق عند الضغط خارج الصندوق مباشرة (على الخلفية)
        modalEl.addEventListener('click', function (e) {
            if (e.target === modalEl) closeModal();
        });
    }

    // ── 5) قرار العرض حسب المتصفح/الجهاز ────────────────────────────
    function runInstallDecision() {
        if (isRunningStandalone() || isAlreadyMarkedInstalled()) return;

        var platform = detectPlatform();

        if (deferredPrompt) {
            showModal('prompt');
        } else if (platform.isIOSSafari) {
            showModal('ios');
        } else if (platform.isMacSafari) {
            showModal('mac');
        }
        // أي متصفح تاني مش بيدعم التثبيت (زي Firefox Desktop) → مفيش عرض
        // لتفادي زرار مايشتغلش.
    }

    // بعض الصفحات (زي index.html) فيها شاشة تحميل مخصّصة بتاخد كام ثانية
    // — منستناش نظهر نافذة التثبيت فوقها أو أثناءها. لو الشاشة دي مش
    // موجودة (زي dashboard.html) هيشتغل بعد تأخير بسيط عادي.
    function scheduleInstallCheck() {
        var loaderEl = document.getElementById('iraqi-loader');

        if (!loaderEl) {
            setTimeout(runInstallDecision, 2200);
            return;
        }

        var done = false;
        function finish() {
            if (done) return;
            done = true;
            setTimeout(runInstallDecision, 800);
        }

        var observer = new MutationObserver(function () {
            if (!document.body.contains(loaderEl)) {
                observer.disconnect();
                finish();
            }
        });
        try {
            observer.observe(document.body, { childList: true });
        } catch (e) { finish(); }

        // أمان إضافي: لو لأي سبب ما اتلقطش اختفاء الشاشة، متستناش أكتر من
        // 16 ثانية (شاشة اللودينج نفسها بتتقفل تلقائيًا خلال 13 ثانية كحد أقصى)
        setTimeout(function () {
            observer.disconnect();
            finish();
        }, 16000);
    }

    // ── 6) الاستماع لأحداث المتصفح الخاصة بالتثبيت ──────────────────
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        if (!modalShownThisPageView && !isRunningStandalone() && !isAlreadyMarkedInstalled()) {
            showModal('prompt');
        }
    });

    window.addEventListener('appinstalled', function () {
        markInstalled();
        closeModal();
        deferredPrompt = null;
    });

    // ── التشغيل ───────────────────────────────────────────────────────
    registerServiceWorker();

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        scheduleInstallCheck();
    } else {
        document.addEventListener('DOMContentLoaded', scheduleInstallCheck);
    }

})();
