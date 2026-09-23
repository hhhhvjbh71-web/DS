// ═══════════════════════════════════════════════════════════════════════
//  firebase-service.js — خدمة الربط بقاعدة بيانات Google Firebase
//  منصة الخلية — أ/ إسلام عبدالواحد لتعليم الأحياء
//  Project: mahmoud-abdeldaem-manassa
// ═══════════════════════════════════════════════════════════════════════

(function (global) {
    'use strict';

    // ── إعدادات Firebase الخاصة بالمشروع ──────────────────────────────
    const firebaseConfig = {
        apiKey: "AIzaSyA-tRgZrEPCi-1Bdx6NoDJYOPorzn5Ep-8",
        authDomain: "mahmoud-abdeldaem-manassa.firebaseapp.com",
        projectId: "mahmoud-abdeldaem-manassa",
        storageBucket: "mahmoud-abdeldaem-manassa.firebasestorage.app",
        messagingSenderId: "53298877358",
        appId: "1:53298877358:web:7fe6de4a69162c057eae3f",
        measurementId: "G-HV2S70S3YW"
    };

    let firebaseApp = null;
    let firestoreDb = null;
    let firebaseAuth = null;
    let isInitialized = false;

    // ── تهيئة Firebase ───────────────────────────────────────────────
    function initFirebase() {
        if (typeof firebase === 'undefined') {
            console.warn('[Firebase] SDK not loaded via script tag yet.');
            return false;
        }

        try {
            // إذا كان firebase-config.js قد هيّأ Firebase بالفعل، استخدم نفس الـ instance
            if (window.db && window.firebase) {
                firestoreDb  = window.db;
                firebaseAuth = window.firebase.auth ? window.firebase.auth() : null;
                firebaseApp  = window.firebase.app ? window.firebase.app() : null;
                isInitialized = true;
                console.log('🔥 [FirebaseService] Reusing existing Firebase instance from firebase-config.js');
                startRealtimeSync();
                return true;
            }

            if (!firebase.apps.length) {
                firebaseApp = firebase.initializeApp(firebaseConfig);
            } else {
                firebaseApp = firebase.app();
            }

            firestoreDb = firebase.firestore();
            // اجعل window.db يشير لنفس الـ instance حتى يتمكن الداشبورد من استخدامه
            window.db     = firestoreDb;
            window.dbNew  = firestoreDb;
            window.firebase = firebase;
            firebaseAuth = firebase.auth ? firebase.auth() : null;
            isInitialized = true;
            console.log('🔥 [Firebase] Connected successfully to project: mahmoud-abdeldaem-manassa');

            // بدء المزامنة الحية للبيانات
            startRealtimeSync();
            return true;
        } catch (error) {
            console.error('[Firebase] Initialization error:', error);
            return false;
        }
    }

    // ── Collections ──────────────────────────────────────────────────
    const COL_USERS    = 'users';
    const COL_COURSES  = 'courses';
    const COL_LESSONS  = 'lessons';
    const COL_CONTENTS = 'contents';
    const COL_CODES    = 'codes';

    // ── LocalStorage Keys ────────────────────────────────────────────
    const USERS_KEY    = 'iraqiplatform_users';
    const LESSONS_KEY  = 'iraqiplatform_lessons';
    const CONTENTS_KEY = 'iraqiplatform_contents';
    const CODES_KEY    = 'iraqiplatform_codes';
    const COURSES_KEY  = 'alsaqr_courses';

    // ── 1. مزامنة المستخدمين (Users) ──────────────────────────────────
    async function syncUsersFromFirestore() {
        if (!firestoreDb) return;
        try {
            const snapshot = await firestoreDb.collection(COL_USERS).get();
            if (!snapshot.empty) {
                const cloudUsers = [];
                snapshot.forEach(doc => {
                    cloudUsers.push(Object.assign({ id: doc.id }, doc.data()));
                });
                
                // دمج مع المستخدمين المحليين
                const localUsers = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
                const mergedMap = {};
                localUsers.forEach(u => { if (u && u.id) mergedMap[u.id] = u; });
                cloudUsers.forEach(u => { if (u && u.id) mergedMap[u.id] = Object.assign({}, mergedMap[u.id] || {}, u); });

                const finalUsers = Object.values(mergedMap);
                localStorage.setItem(USERS_KEY, JSON.stringify(finalUsers));
                console.log('🔥 [Firebase] Synced ' + finalUsers.length + ' users from cloud.');
            }
        } catch (e) {
            console.warn('[Firebase] Users sync notice:', e.message);
        }
    }

    async function saveUserToFirestore(user) {
        if (!user || !user.id) return;
        if (firestoreDb) {
            try {
                await firestoreDb.collection(COL_USERS).doc(String(user.id)).set(user, { merge: true });
                console.log('🔥 [Firebase] User saved to cloud:', user.name || user.id);
            } catch (e) {
                console.warn('[Firebase] Error saving user to cloud:', e);
            }
        }
    }

    // ── 2. مزامنة الكورسات (Courses) ──────────────────────────────────
    async function syncCoursesFromFirestore() {
        if (!firestoreDb) return;
        try {
            const snapshot = await firestoreDb.collection(COL_COURSES).get();
            if (!snapshot.empty) {
                const cloudCourses = [];
                snapshot.forEach(doc => {
                    cloudCourses.push(Object.assign({ id: doc.id }, doc.data()));
                });

                if (cloudCourses.length > 0) {
                    const localCourses = JSON.parse(localStorage.getItem(COURSES_KEY) || '[]');
                    const map = {};
                    localCourses.forEach(c => { if (c && c.id) map[c.id] = c; });
                    cloudCourses.forEach(c => { if (c && c.id) map[c.id] = Object.assign({}, map[c.id] || {}, c); });

                    const finalCourses = Object.values(map);
                    localStorage.setItem(COURSES_KEY, JSON.stringify(finalCourses));
                    if (typeof window.refreshCoursesUI === 'function') {
                        window.refreshCoursesUI();
                    }
                    console.log('🔥 [Firebase] Synced ' + finalCourses.length + ' courses from cloud.');
                }
            }
        } catch (e) {
            console.warn('[Firebase] Courses sync notice:', e.message);
        }
    }

    async function saveCourseToFirestore(course) {
        if (!course || !course.id) return;
        if (firestoreDb) {
            try {
                await firestoreDb.collection(COL_COURSES).doc(String(course.id)).set(course, { merge: true });
                console.log('🔥 [Firebase] Course saved to cloud:', course.title || course.id);
            } catch (e) {
                console.warn('[Firebase] Error saving course to cloud:', e);
            }
        }
    }

    // ── 3. مزامنة الدروس والمحتوى (Lessons & Contents) ────────────────
    async function syncLessonsFromFirestore() {
        if (!firestoreDb) return;
        try {
            const [lessonsSnap, contentsSnap] = await Promise.all([
                firestoreDb.collection(COL_LESSONS).get(),
                firestoreDb.collection(COL_CONTENTS).get()
            ]);

            if (!lessonsSnap.empty) {
                const cloudLessons = [];
                lessonsSnap.forEach(d => cloudLessons.push(Object.assign({ lessonId: d.id }, d.data())));
                localStorage.setItem(LESSONS_KEY, JSON.stringify(cloudLessons));
            }

            if (!contentsSnap.empty) {
                const cloudContents = [];
                contentsSnap.forEach(d => cloudContents.push(Object.assign({ contentId: d.id }, d.data())));
                localStorage.setItem(CONTENTS_KEY, JSON.stringify(cloudContents));
            }
        } catch (e) {
            console.warn('[Firebase] Lessons sync notice:', e.message);
        }
    }

    async function saveLessonToFirestore(lesson) {
        if (!lesson || !lesson.lessonId) return;
        if (firestoreDb) {
            try {
                await firestoreDb.collection(COL_LESSONS).doc(String(lesson.lessonId)).set(lesson, { merge: true });
            } catch (e) {
                console.warn('[Firebase] Error saving lesson:', e);
            }
        }
    }

    async function saveContentToFirestore(content) {
        if (!content || !content.contentId) return;
        if (firestoreDb) {
            try {
                await firestoreDb.collection(COL_CONTENTS).doc(String(content.contentId)).set(content, { merge: true });
            } catch (e) {
                console.warn('[Firebase] Error saving content:', e);
            }
        }
    }

    // ── 4. مزامنة أكواد التفعيل (Codes) ──────────────────────────────
    async function syncCodesFromFirestore() {
        if (!firestoreDb) return;
        try {
            const snapshot = await firestoreDb.collection(COL_CODES).get();
            if (!snapshot.empty) {
                const cloudCodes = [];
                snapshot.forEach(d => cloudCodes.push(Object.assign({ id: d.id }, d.data())));
                const localCodes = JSON.parse(localStorage.getItem(CODES_KEY) || '[]');
                const map = {};
                localCodes.forEach(c => { if (c && c.code) map[c.code] = c; });
                cloudCodes.forEach(c => { if (c && c.code) map[c.code] = c; });
                localStorage.setItem(CODES_KEY, JSON.stringify(Object.values(map)));
            }
        } catch (e) {
            console.warn('[Firebase] Codes sync notice:', e.message);
        }
    }

    async function saveCodeToFirestore(codeObj) {
        if (!codeObj || !codeObj.code) return;
        if (firestoreDb) {
            try {
                const docId = String(codeObj.id || codeObj.code);
                await firestoreDb.collection(COL_CODES).doc(docId).set(codeObj, { merge: true });
            } catch (e) {
                console.warn('[Firebase] Error saving code:', e);
            }
        }
    }

    // ── مزامنة platform_data/courses_list (المصدر الحقيقي للداشبورد) ─
    // الداشبورد يحفظ في platform_data/courses_list.items[]
    // هنا نستمع لتغييراتها ونكتبها في alsaqr_courses حتى يراها Index
    function startPlatformDataSync() {
        if (!firestoreDb) return;
        try {
            firestoreDb.collection('platform_data').doc('courses_list')
                .onSnapshot({ includeMetadataChanges: false }, (doc) => {
                    if (!doc.exists) return;
                    const data = doc.data() || {};
                    const items = Array.isArray(data.items) ? data.items : [];
                    if (items.length > 0) {
                        localStorage.setItem(COURSES_KEY, JSON.stringify(items));
                        localStorage.setItem('alsaqr_courses_initialized', '1');
                        localStorage.setItem('alsaqr_courses_fb_migrated', '1');
                        console.log('🔥 [FirebaseService] platform_data sync:', items.length, 'courses → alsaqr_courses');
                        if (typeof window.refreshCoursesUI === 'function') {
                            try { window.refreshCoursesUI(); } catch(e) {}
                        }
                        // أطلق الحدث حتى يتحدث dashboard-bridge.js فوراً
                        window.dispatchEvent(new CustomEvent('iraqiCoursesUpdated'));
                    }
                }, err => console.warn('[FirebaseService] platform_data snapshot error:', err.message));
        } catch(e) {
            console.warn('[FirebaseService] platform_data sync setup error:', e.message);
        }
    }

    // ── Realtime Listeners ───────────────────────────────────────────
    function startRealtimeSync() {
        if (!firestoreDb) return;

        // ─ المصدر الأساسي: platform_data/courses_list (يكتب فيها الداشبورد) ─
        startPlatformDataSync();

        // استماع للتحديثات في collection courses (للتوافق مع firebase-service القديم)
        try {
            firestoreDb.collection(COL_COURSES).onSnapshot(snapshot => {
                const courses = [];
                snapshot.forEach(doc => courses.push(Object.assign({ id: doc.id }, doc.data())));
                if (courses.length > 0) {
                    // نضيف هذه الكورسات لـ alsaqr_courses بدمجها مع الموجود
                    const existing = JSON.parse(localStorage.getItem(COURSES_KEY) || '[]');
                    const map = {};
                    existing.forEach(c => { if (c && c.id) map[String(c.id)] = c; });
                    courses.forEach(c => { if (c && c.id) map[String(c.id)] = c; });
                    localStorage.setItem(COURSES_KEY, JSON.stringify(Object.values(map)));
                    if (typeof window.refreshCoursesUI === 'function') window.refreshCoursesUI();
                }
            }, err => console.warn('[Firebase Snapshot error]:', err.message));

            // استماع لتحديثات الأكواد
            firestoreDb.collection(COL_CODES).onSnapshot(snapshot => {
                const codes = [];
                snapshot.forEach(doc => codes.push(Object.assign({ id: doc.id }, doc.data())));
                if (codes.length > 0) {
                    localStorage.setItem(CODES_KEY, JSON.stringify(codes));
                }
            }, err => console.warn('[Firebase Codes Snapshot error]:', err.message));
        } catch (e) {
            console.warn('[Firebase] Snapshot registration:', e.message);
        }

        // تشغيل المزامنة المبدئية — ترتيب الأولويات مهم
        syncUsersFromFirestore();
        syncCodesFromFirestore();
        // مزامنة الكورسات والدروس والمحتوى (مهم لعرض الفيديوهات من Firebase)
        syncCoursesFromFirestore().then(function() {
            // بعد مزامنة الكورسات نزامن الدروس
            syncLessonsFromFirestore().then(function() {
                // أطلق حدث لتحديث الـ Bridge مع الدروس الجديدة
                try {
                    if (typeof window.IRAQI_BRIDGE !== 'undefined' && typeof window.IRAQI_BRIDGE.sync === 'function') {
                        window.IRAQI_BRIDGE.sync();
                    }
                } catch(e) {}
                window.dispatchEvent(new CustomEvent('iraqiLessonsUpdated'));
            }).catch(function(e) { console.warn('[startRealtimeSync] lessons:', e.message); });
        }).catch(function(e) { console.warn('[startRealtimeSync] courses:', e.message); });
    }

    // ── تصدير خدمة Firebase للنافذة العامة ───────────────────────────
    global.FirebaseService = {
        config: firebaseConfig,
        init: initFirebase,
        isReady: function () { return isInitialized; },
        getDb: function () { return firestoreDb; },
        getAuth: function () { return firebaseAuth; },
        users: {
            sync: syncUsersFromFirestore,
            save: saveUserToFirestore
        },
        courses: {
            sync: syncCoursesFromFirestore,
            save: saveCourseToFirestore
        },
        lessons: {
            sync: syncLessonsFromFirestore,
            saveLesson: saveLessonToFirestore,
            saveContent: saveContentToFirestore
        },
        codes: {
            sync: syncCodesFromFirestore,
            save: saveCodeToFirestore
        }
    };

    // التشغيل التلقائي عند اكتمال تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFirebase);
    } else {
        initFirebase();
    }

})(window);
