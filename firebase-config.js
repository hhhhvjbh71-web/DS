// ============================================================
//  firebase-config.js
//  إعدادات Firebase — م/ مصطفى محمود
//
//  القاعدة النشطة: mostafa-mahmoud-88653
//    (مزامنة الأجهزة + كل بيانات البرنامج)
//
//  ملاحظة مهمة:
//    - هذا الملف لا يُهيئ Firebase مباشرةً (لأن SDKs تُحمَّل async)
//    - التهيئة الفعلية تتم داخل ensureDeviceSyncFirebaseInitialized()
//      في app.js عند أول استخدام فعلي للشبكة
//    - window.FIREBASE_MAIN_CONFIG: يُخزَّن هنا للرجوع إليه إذا لزم
// ============================================================

window.FIREBASE_MAIN_CONFIG = {
    apiKey: "AIzaSyCxVI6EpEV1F-XfbRgUgUib7bXsZ3bTseo",
    authDomain: "mostafa-mahmoud-88653.firebaseapp.com",
    projectId: "mostafa-mahmoud-88653",
    storageBucket: "mostafa-mahmoud-88653.firebasestorage.app",
    messagingSenderId: "836277027378",
    appId: "1:836277027378:web:fbf02fee5d707e69a8722b",
    measurementId: "G-7YBMQDN0EN"
};

// قاعدة المنصة التعليمية — معطّلة (الإعدادات فارغة عمداً)
window.FIREBASE_PLATFORM_CONFIG = null;

console.info('[firebase-config.js] ✅ إعدادات Firebase محمّلة — القاعدة النشطة: mostafa-mahmoud-88653');
