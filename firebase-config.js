// ═══════════════════════════════════════════════════════════════════════
//  firebase-config.js — إعداد Firebase وتهيئة window.db
//  منصة الخلية — أ/ إسلام عبدالواحد لتعليم الأحياء
//  Project: mahmoud-abdeldaem-manassa
// ═══════════════════════════════════════════════════════════════════════
//  هذا الملف يُحمَّل مرة واحدة في <head> قبل أي script آخر يعتمد على Firebase.
//  يُعرِّف window.db (Firestore) و window.firebase لاستخدامها في الداشبورد.
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ── إعدادات مشروع Firebase الرسمي ──────────────────────────────────
    var firebaseConfig = {
        apiKey:            "AIzaSyA-tRgZrEPCi-1Bdx6NoDJYOPorzn5Ep-8",
        authDomain:        "mahmoud-abdeldaem-manassa.firebaseapp.com",
        projectId:         "mahmoud-abdeldaem-manassa",
        storageBucket:     "mahmoud-abdeldaem-manassa.firebasestorage.app",
        messagingSenderId: "53298877358",
        appId:             "1:53298877358:web:7fe6de4a69162c057eae3f",
        measurementId:     "G-HV2S70S3YW"
    };

    // ── تهيئة Firebase مرة واحدة فقط ──────────────────────────────────
    function initConfig() {
        if (typeof firebase === 'undefined') {
            console.error('[firebase-config] Firebase SDK غير محمّل. تأكد من تحميل firebase-app-compat.js قبل هذا الملف.');
            return;
        }

        try {
            var app;
            if (!firebase.apps || !firebase.apps.length) {
                app = firebase.initializeApp(firebaseConfig);
            } else {
                app = firebase.app();
            }

            // ── window.db: Firestore الأساسي (المستخدم في جميع عمليات الكورسات) ──
            window.db     = firebase.firestore();
            // window.dbNew يُشير لنفس المشروع (لا يوجد مشروع ثانٍ)
            window.dbNew  = window.db;
            window.firebase = firebase;

            // تفعيل Persistence (offline support) إن أمكن
            try {
                window.db.enablePersistence({ synchronizeTabs: true }).catch(function(e) {
                    if (e.code !== 'failed-precondition' && e.code !== 'unimplemented') {
                        console.warn('[firebase-config] Persistence warning:', e.code);
                    }
                });
            } catch(e) {}

            console.log('🔥 [firebase-config] ✅ Firebase جاهز — project: mahmoud-abdeldaem-manassa | db:', !!window.db);

            // ── جلب الكورسات فوراً لأي زائر (بدون شرط تسجيل دخول) ──────────
            // هذا يضمن ظهور الكورسات في الصفحة الرئيسية حتى في Incognito
            (function fetchCoursesEarly() {
                try {
                    window.db.collection('platform_data').doc('courses_list').get()
                        .then(function(doc) {
                            if (!doc.exists) return;
                            var data = doc.data() || {};
                            var items = Array.isArray(data.items) ? data.items : [];
                            if (items.length === 0) return;

                            // حفظ في localStorage حتى تجده dashboard-bridge عند استدعاء getAllCourses
                            localStorage.setItem('alsaqr_courses', JSON.stringify(items));
                            localStorage.setItem('alsaqr_courses_initialized', '1');

                            // مزامنة فورية إذا كان bridge محمّلاً
                            if (window.IRAQI_BRIDGE && typeof window.IRAQI_BRIDGE.sync === 'function') {
                                window.IRAQI_BRIDGE.sync();
                            }

                            // تحديث واجهة الكورسات إذا كانت الصفحة مفتوحة
                            if (typeof window.refreshCoursesUI === 'function') {
                                window.refreshCoursesUI();
                            }

                            // محاولة ثانية بعد 300ms لو الـ bridge لم يكن جاهزاً بعد
                            setTimeout(function() {
                                if (window.IRAQI_BRIDGE && typeof window.IRAQI_BRIDGE.sync === 'function') {
                                    window.IRAQI_BRIDGE.sync();
                                }
                                if (typeof window.refreshCoursesUI === 'function') {
                                    window.refreshCoursesUI();
                                }
                            }, 300);

                            // إطلاق حدث تحديث الكورسات
                            window.dispatchEvent(new CustomEvent('iraqiCoursesUpdated'));

                            console.log('[firebase-config] ✅ الكورسات محمّلة مبكراً:', items.length, 'كورس');
                        })
                        .catch(function(e) {
                            console.warn('[firebase-config] تعذّر جلب الكورسات المبكر:', e.message);
                        });
                } catch(e) {}
            })();

            // إشعار أي كود ينتظر Firebase بأنه أصبح جاهزاً
            window.dispatchEvent(new CustomEvent('firebaseReady', { detail: { db: window.db } }));

        } catch (error) {
            console.error('[firebase-config] ❌ خطأ في التهيئة:', error);
        }
    }

    // ── التشغيل: إذا SDK محمّل → شغّل فوراً، وإلا انتظر DOMContentLoaded ──
    if (typeof firebase !== 'undefined') {
        initConfig();
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            if (typeof firebase !== 'undefined') {
                initConfig();
            } else {
                console.error('[firebase-config] Firebase SDK لم يُحمَّل حتى بعد DOMContentLoaded.');
            }
        });
    }

})();
