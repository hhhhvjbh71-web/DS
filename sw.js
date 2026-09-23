// ═══════════════════════════════════════════════════════════════════════
//  sw.js — Service Worker لتطبيق الـ PWA
//  منصة الخلية — أ/ إسلام عبدالواحد لتعليم الأحياء
//
//  فكرة التصميم (مهم تقرأها قبل التعديل):
//  ────────────────────────────────────────────────────────────────────
//  المنصة عندها بالفعل نظام تحديث خاص بيها (cache-buster.js) بيراقب
//  version.json وبيعمل Hard Reload لما يلاقي نسخة جديدة. الهدف من هذا
//  الملف إنه "يضيف" فوق النظام ده تجربة PWA حقيقية (تثبيت + Offline
//  بسيط) من غير ما "يزاحمه" أو يسبب ظهور نسخة قديمة:
//
//  • version.json: ابداً ما يتم Cache-ه ولا اعتراضه — بيعدي للنتورك زي
//    ما هو عشان cache-buster.js يفضل شغال 100% زي ما هو مصمم.
//  • صفحات HTML وملفات JS/CSS بتاعة نفس الموقع: استراتيجية
//    "Network First" — يعني أول حاجة يحاول يجيبها من السيرفر، ولو
//    الشبكة اتأخرت/فشلت يرجع للـ Cache كحل احتياطي بس (مش أساسي).
//    ده معناه إن أي تحديث يترفع على الاستضافة يوصل فورًا لأي مستخدم
//    عنده إنترنت، والـ Cache بيتفعل بس في حالة الأوفلاين.
//  • الصور/الخطوط ومكتبات الـ CDN الثابتة (Firebase SDK, pdf.js,
//    Google Fonts): استراتيجية "Cache First" لأنها ثقيلة ونادرًا
//    ما تتغير (ومعظمها مثبّت برقم إصدار في الرابط نفسه).
//  • أي طلب مش GET (زي طلبات Firebase/Firestore/Auth) بيتجاهله الـ
//    Service Worker تمامًا ومايتدخلش فيه إطلاقًا.
//
//  رقم الإصدار (APP_VERSION) بيتحدّث تلقائيًا مع كل نشر عبر
//  update-version.sh / update-version.ps1 (نفس الملفين اللي بيحدّثوا
//  version.json و ?v= في index.html) — وده اللي بيخلي المتصفح يكتشف
//  إن فيه Service Worker جديد فور ما يترفع تحديث (لأن محتوى الملف نفسه
//  بيتغيّر، مش بس اسم الكاش).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// ⚠️ هذا السطر يتحدّث تلقائيًا مع كل تشغيل لسكربت update-version.*
const APP_VERSION = '20260923-1238';

const STATIC_CACHE  = 'manassa-static-'  + APP_VERSION;
const RUNTIME_CACHE = 'manassa-runtime-' + APP_VERSION;
const CURRENT_CACHES = [STATIC_CACHE, RUNTIME_CACHE];

// أصول أساسية بس (خفيفة) بتتحمّل وقت التثبيت — عمدًا مفيش هنا أي
// صفحة HTML أو app.js/style.css عشان النظام يفضل معتمد على الشبكة
// أولاً لكل حاجة ديناميكية.
const PRECACHE_URLS = [
  'manifest.json',
  'offline.html',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// امتدادات بيتم التعامل معها كـ "أصول ثابتة" (Cache First)
const STATIC_ASSET_REGEX = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/i;

// نطاقات CDN يوثق فيها (مكتبات مثبّتة برقم إصدار في الرابط)
const TRUSTED_CDN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com',
  'cdnjs.cloudflare.com'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS).catch(function (err) {
          // لو ملف Precache فشل (مثلاً offline.html لسه مش موجود) منمنعش
          // التثبيت بالكامل بسببه.
          console.warn('[SW] Precache warning:', err);
        });
      })
      .then(function () {
        // فعّل الإصدار الجديد فورًا من غير انتظار إغلاق كل التابات
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(
          names
            .filter(function (name) { return !CURRENT_CACHES.includes(name); })
            .map(function (name) { return caches.delete(name); })
        );
      })
      .then(function () {
        // خلي الـ Service Worker الجديد يتحكم في كل الصفحات المفتوحة فورًا
        return self.clients.claim();
      })
  );
});

// دعم استدعاء يدوي لـ skipWaiting من الصفحة لو احتجنا مستقبلاً
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isTrustedCdn(url) {
  return TRUSTED_CDN_HOSTS.indexOf(url.hostname) !== -1;
}

// Network First: يحاول الشبكة أولاً، ولو فشلت يرجع للـ Cache
function networkFirst(request) {
  return fetch(request)
    .then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(RUNTIME_CACHE).then(function (cache) {
          cache.put(request, copy).catch(function () {});
        });
      }
      return response;
    })
    .catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('offline.html');
        }
        return Promise.reject('no-match');
      });
    });
}

// Cache First + تحديث في الخلفية (Stale-While-Revalidate)
function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    var networkFetch = fetch(request).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(RUNTIME_CACHE).then(function (cache) {
          cache.put(request, copy).catch(function () {});
        });
      }
      return response;
    }).catch(function () { return cached; });

    return cached || networkFetch;
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // متعملش أي تدخل غير طلبات GET (طلبات Firebase/Firestore/Auth
  // بتستخدم POST/PUT كتير — سيبها تعدي زي ما هي)
  if (request.method !== 'GET') return;

  // حماية من خطأ معروف في Chrome مع طلبات only-if-cached الخاصة بالـ prefetch
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  var url = new URL(request.url);

  // طلبات فيها Range (فيديو/PDF) — سيبها للمتصفح مباشرة عشان الـ seek
  if (request.headers.has('range')) return;

  // version.json: ممنوع نتدخل فيه إطلاقًا — نظام cache-buster.js
  // معتمد عليه يكون طازة 100% من السيرفر دايمًا.
  if (url.pathname.endsWith('/version.json') || url.pathname === '/version.json' || url.pathname.endsWith('version.json')) {
    return;
  }

  var isSameOrigin = url.origin === self.location.origin;

  // ملفات ثابتة (صور/خطوط) من نفس الموقع أو من CDN موثوق → Cache First
  if (STATIC_ASSET_REGEX.test(url.pathname) && (isSameOrigin || isTrustedCdn(url))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // مكتبات JS الخاصة بـ Firebase / pdf.js من CDN موثوق → Cache First
  if (isTrustedCdn(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // أي حاجة تانية من نفس الموقع (HTML, JS, CSS, JSON عدا version.json)
  // → Network First عشان أي تحديث يوصل فورًا
  if (isSameOrigin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // أي طلب تاني (مثل Firebase APIs) → سيبه يعدي عادي من غير تدخل
});
