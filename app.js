// ═══════════════════════════════════════════════════════════════
// منصة الخلية — أ/ إسلام عبدالواحد — Main Application
// SPA Router, Page Renderers, Components, Interactions
// Session: localStorage key = 'iraqiplatform_current_user'
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ── State ────────────────────────────────────────────────────
    let currentPage = 'home';
    let isLoggedIn = false;
    let currentUser = null;
    let mobileMenuOpen = false;
    let lessonSidebarOpen = false;

    // ── Admin Helper ─────────────────────────────────────────────
    function isAdmin() {
        return isLoggedIn && currentUser && currentUser.email === ADMIN_EMAIL;
    }

    // ── Session Persistence ──────────────────────────────────────
    const SESSION_KEY = 'iraqiplatform_current_user';

    function loadSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (raw) {
                const user = JSON.parse(raw);
                if (user && user.id && (user.name || user.phone)) {
                    currentUser = user;
                    isLoggedIn = true;
                }
            }
        } catch (e) { /* ignore corrupt data */ }
    }

    function saveSession(user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        currentUser = user;
        isLoggedIn = true;
        // فور تسجيل الدخول: تأكد من مزامنة محاولات الاختبار الخاصة بيه
        // من Firebase فورًا (مش بس عن طريق إعادة المحاولة التلقائية)
        try {
            if (window.IRAQI_BRIDGE && typeof window.IRAQI_BRIDGE.syncAttempts === 'function') {
                window.IRAQI_BRIDGE.syncAttempts();
            }
        } catch (e) {}
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
        currentUser = null;
        isLoggedIn = false;
    }

    // ── Users DB ─────────────────────────────────────────────────
    const USERS_KEY = 'iraqiplatform_users';

    function getUsers() {
        try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
        catch (e) { return []; }
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        if (typeof window.FirebaseService !== 'undefined' && window.FirebaseService.users) {
            try { (users || []).forEach(u => window.FirebaseService.users.save(u)); } catch (e) { }
        }
    }

    function findUser(emailOrPhone) {
        return getUsers().find(u =>
            u.email === emailOrPhone || u.phone === emailOrPhone
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTHENTICATION — 4 خطوات منفصلة تمامًا عن بعض، كل واحدة مسؤولة
    // عن حاجة واحدة بس (بدل ما يكونوا مخلوطين جوه handleLogin القديمة):
    //   1) findAccountByPhone   → هل الحساب موجود؟ (Firestore هو المرجع)
    //   2) verifyAccountPassword → هل كلمة المرور صح؟
    //   3) saveSession           → إنشاء جلسة الدخول (موجودة فوق)
    //   4) loadSession           → استعادة الجلسة + تأكيد صلاحيتها (فوق)
    // ═══════════════════════════════════════════════════════════════

    // 1) البحث عن حساب برقم الهاتف — قاعدة البيانات (Firestore) هي
    //    المصدر الأساسي والموثوق دايمًا، مش بس Fallback لما الكاش يكون
    //    فاضي. الكاش المحلي بيتحدّث بعد كل بحث ناجح كتحسين أداء فقط،
    //    وبيُستخدم هو نفسه كحل احتياطي وحيد لو Firebase كان غير متاح
    //    فعليًا (مثلاً الطالب أوفلاين).
    async function findAccountByPhone(phone) {
        if (window.db) {
            try {
                const snap = await window.db.collection('users').where('phone', '==', phone).limit(1).get();
                if (!snap.empty) {
                    const remote = Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
                    try {
                        const localUsers = getUsers();
                        const idx = localUsers.findIndex(u => String(u.id) === String(remote.id));
                        if (idx >= 0) localUsers[idx] = Object.assign({}, localUsers[idx], remote);
                        else localUsers.push(remote);
                        localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
                    } catch (e) { /* تحديث الكاش تحسين ثانوي فقط — تجاهل أي خطأ فيه */ }
                    return remote;
                }
                return null; // Firestore أكّد: الرقم غير مسجّل فعليًا
            } catch (e) {
                console.warn('[Auth] تعذّر الوصول لقاعدة البيانات، استخدام النسخة المحلية كحل احتياطي:', e.message);
                // نكمل تحت للـ fallback المحلي بدل ما نمنع تسجيل الدخول بالكامل بسبب مشكلة شبكة مؤقتة
            }
        }
        // Fallback فقط عند تعذّر الوصول الفعلي لقاعدة البيانات (أوفلاين مثلاً)
        return getUsers().find(u => (u.phone || '').replace(/[^0-9]/g, '') === phone) || null;
    }

    // 2) التحقق من كلمة المرور — منفصل تمامًا عن التحقق من وجود الحساب
    function verifyAccountPassword(account, password) {
        return !!(account && account.password === password);
    }

    // 4) تأكيد صلاحية الجلسة المستعادة في الخلفية — بدون تعطيل عرض
    //    الواجهة فورًا (تفاديًا لأي Flash)، لكن لو تبيّن إن الحساب
    //    اتحذف فعليًا من قاعدة البيانات، يتم إنهاء الجلسة تلقائيًا
    //    بدل ما يفضل المستخدم "مسجّل دخول" ببيانات وهمية/قديمة.
    function verifySessionInBackground() {
        if (!isLoggedIn || !currentUser || !currentUser.id || !window.db) return;
        window.db.collection('users').doc(String(currentUser.id)).get().then(function (doc) {
            if (!doc.exists) {
                console.warn('[Auth] الحساب المحفوظ محليًا لم يعد موجودًا في قاعدة البيانات — سيتم إنهاء الجلسة.');
                clearSession();
                if (typeof window.handleRoute === 'function') window.handleRoute();
                return;
            }
            // حدّث بيانات الجلسة بأحدث نسخة من قاعدة البيانات (نفس المعرف نفسه، بيانات محدّثة فقط)
            var fresh = Object.assign({ id: doc.id }, doc.data());
            currentUser = Object.assign({}, currentUser, fresh);
            try { localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser)); } catch (e) {}
        }).catch(function (e) {
            console.warn('[Auth] تعذّر تأكيد صلاحية الجلسة (سيتم الاعتماد على النسخة المحلية مؤقتًا):', e.message);
        });
    }

    // ── Password Validation (min 6 chars, English letters or digits) ─
    function validatePassword(pw) {
        // At least 6 characters: English letters or digits only
        return /^[a-zA-Z0-9]{6,}$/.test(pw);
    }

    // ── Router ──────────────────────────────────────────────────
    function initRouter() {
        window.addEventListener('hashchange', handleRoute);
        handleRoute();
    }

    function handleRoute() {
        const hash = window.location.hash.slice(1) || 'home';
        const [page, ...params] = hash.split('/');
        currentPage = page;
        renderPage(page, params);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        updateActiveNav();
        closeMobileMenu();
    }

    function navigate(hash) {
        window.location.hash = hash;
    }

    // يُستخدم من dashboard-bridge.js لإعادة رسم الصفحة الحالية فور وصول
    // بيانات جديدة من Firebase (مثل الاختبارات) — بدون تغيير الـ hash
    window.handleRoute = handleRoute;

    // loadLessonIframe: plays YouTube video inside the platform after thumbnail click
    window.loadLessonIframe = function(embedUrl, thumbEl) {
        if (!embedUrl) return;
        var container = document.getElementById('lessonVideoEmbedContainer');
        if (!container) return;

        var sep = embedUrl.indexOf('?') > -1 ? '&' : '?';
        var playUrl = embedUrl + sep + 'autoplay=1';

        var shields = [
            '<div class="yt-shield yt-shield-top" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
            '<div class="yt-shield yt-shield-tr" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
            '<div class="yt-shield yt-shield-tl" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
            '<div class="yt-shield yt-shield-br" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
            '<div class="yt-shield yt-shield-bl" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>'
        ].join('');

        container.innerHTML = [
            '<iframe src="' + playUrl + '" frameborder="0" allowfullscreen',
            ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"',
            ' referrerpolicy="strict-origin-when-cross-origin"',
            ' style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;border-radius:14px;z-index:1;"></iframe>',
            shields
        ].join('');
    };

    window._showEmbedError = function(container, embedUrl) {
        var m = (embedUrl || '').match(/embed\/([A-Za-z0-9_-]{11})/);
        var ytId = m ? m[1] : '';
        container.innerHTML =
            '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'background:linear-gradient(135deg,#0f0f0f,#1a1a2e);border-radius:14px;padding:32px;text-align:center;gap:16px;">' +
            '<div style="font-size:3rem;">&#127910;</div>' +
            '<h3 style="color:#fff;margin:0;font-size:1.1rem;font-weight:800;">الفيديو غير متاح للتضمين</h3>' +
            '<p style="color:rgba(255,255,255,0.5);margin:0;font-size:0.85rem;max-width:320px;line-height:1.6;">' +
            'تأكد من تفعيل خاصية التضمين من إعدادات الفيديو في YouTube Studio.</p>' +
            '<div style="background:rgba(255,255,255,0.07);border-radius:12px;padding:14px 20px;font-size:0.82rem;' +
            'color:rgba(255,255,255,0.65);max-width:360px;text-align:right;direction:rtl;line-height:2;">' +
            '<strong style="color:#F59E0B;">&#128272; للمدرس/المسؤول:</strong><br>' +
            '&#9312; افتح YouTube Studio<br>' +
            '&#9313; اختر الفيديو &larr; Edit<br>' +
            '&#9314; More Options &larr; فعّل <strong>Allow embedding &#9989;</strong><br>' +
            '&#9315; احفظ التغييرات' +
            '</div>' +
            '</div>';
    };



    // ── Page Renderer ───────────────────────────────────────────
    function renderPage(page, params) {
        const content = document.getElementById('app-content');
        const footer = document.getElementById('main-footer');

        switch (page) {
            case 'home':
                content.innerHTML = renderHomePage();
                footer.style.display = '';
                initHomeAnimations();
                break;
            case 'courses':
                content.innerHTML = renderCoursesPage();
                footer.style.display = '';
                initCoursesPage();
                break;
            case 'course':
                content.innerHTML = renderCourseDetailsPage(params[0]);
                footer.style.display = '';
                initCourseDetailsPage();
                break;
            case 'lesson':
                content.innerHTML = renderLessonPage(params[0], params[1]);
                footer.style.display = 'none';
                initLessonPage();
                break;
            case 'license':
                content.innerHTML = renderLicensePage(params[0]);
                footer.style.display = '';
                initLicensePage();
                break;
            case 'dashboard':
                if (!isLoggedIn) { navigate('login'); return; }
                content.innerHTML = renderDashboardPage();
                footer.style.display = '';
                initHomeAnimations();
                break;
            case 'profile':
                if (!isLoggedIn) { navigate('login'); return; }
                content.innerHTML = renderProfilePage();
                footer.style.display = '';
                break;
            case 'admin':
                if (!isAdmin()) { navigate('login'); return; }
                content.innerHTML = renderAdminPage();
                footer.style.display = '';
                break;
            case 'admin-course':
                if (!isAdmin()) { navigate('login'); return; }
                content.innerHTML = renderAdminCoursePage(params[0]);
                footer.style.display = '';
                initAdminCoursePage();
                break;
            case 'login':
                content.innerHTML = renderLoginPage();
                footer.style.display = 'none';
                initAuthPage();
                break;
            case 'register':
                content.innerHTML = renderRegisterPage();
                footer.style.display = 'none';
                initAuthPage();
                break;
            case 'test':
                // test/quizId/courseId/lessonId
                content.innerHTML = renderTestPage(params[0], params[1], params[2]);
                footer.style.display = 'none';
                window.scrollTo(0, 0);
                initTestPage(params[0], params[1], params[2]);
                break;
            default:
                content.innerHTML = render404Page();
                footer.style.display = '';
        }

        content.classList.add('page-transition');
        setTimeout(() => content.classList.remove('page-transition'), 500);
        initScrollReveal();
    }

    // ── Update Active Nav ───────────────────────────────────────
    function updateActiveNav() {
        document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
            const href = link.getAttribute('data-page');
            link.classList.toggle('active', href === currentPage);
        });
    }

    // ── User initials helper ─────────────────────────────────────
    function getUserInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return parts[0][0] + parts[1][0];
        return parts[0].slice(0, 2);
    }

    // ═══════════════════════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════════════════════
    function renderHeader() {
        const initials = currentUser ? getUserInitials(currentUser.name) : '';
        const userName = currentUser ? currentUser.name : '';
        const userEmail = currentUser ? (currentUser.email || '') : '';
        const userGrade = currentUser ? (currentUser.grade || '') : '';

        return `
        <header class="header" id="main-header">
            <div class="container">
                <a href="#home" class="header-logo">
                    <div class="header-logo-icon">
                        <svg class="header-logo-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="bioLogoCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#67E8F9"/>
                                    <stop offset="50%" stop-color="#06B6D4"/>
                                    <stop offset="100%" stop-color="#0E7490"/>
                                </linearGradient>
                                <linearGradient id="bioLogoTeal" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#6EE7B7"/>
                                    <stop offset="50%" stop-color="#10B981"/>
                                    <stop offset="100%" stop-color="#065F46"/>
                                </linearGradient>
                                <filter id="bioLogoGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#06B6D4" flood-opacity="0.35"/>
                                </filter>
                            </defs>
                            <!-- DNA double helix -->
                            <path d="M14,6 C14,16 34,16 34,24 C34,32 14,32 14,42" stroke="url(#bioLogoCyan)" stroke-width="2.6" stroke-linecap="round" fill="none" filter="url(#bioLogoGlow)"/>
                            <path d="M34,6 C34,16 14,16 14,24 C14,32 34,32 34,42" stroke="url(#bioLogoTeal)" stroke-width="2.6" stroke-linecap="round" fill="none"/>
                            <line x1="14" y1="6" x2="34" y2="6" stroke="url(#bioLogoCyan)" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
                            <line x1="34" y1="24" x2="14" y2="24" stroke="url(#bioLogoTeal)" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
                            <line x1="14" y1="42" x2="34" y2="42" stroke="url(#bioLogoCyan)" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
                            <circle cx="14" cy="6" r="2.3" fill="url(#bioLogoCyan)"/>
                            <circle cx="34" cy="6" r="2.3" fill="url(#bioLogoTeal)" filter="url(#bioLogoGlow)"/>
                            <circle cx="34" cy="24" r="2.3" fill="url(#bioLogoCyan)"/>
                            <circle cx="14" cy="24" r="2.3" fill="url(#bioLogoTeal)"/>
                            <circle cx="14" cy="42" r="2.3" fill="url(#bioLogoCyan)"/>
                            <circle cx="34" cy="42" r="2.3" fill="url(#bioLogoTeal)"/>
                        </svg>
                    </div>
                    <div>
                        <div class="header-logo-text">${SITE_CONFIG.name}</div>
                        <div class="header-logo-sub">${SITE_CONFIG.subtitle}</div>
                    </div>
                </a>

                <nav class="header-nav">
                    <a href="#home" class="nav-link" data-page="home">Home</a>
                    <a href="#courses" class="nav-link" data-page="courses">Courses</a>
                    <a href="#home" onclick="setTimeout(function(){scrollToSection('courses-section')},100)" class="nav-link">All Courses</a>
                    <a href="#home" onclick="setTimeout(function(){scrollToSection('features-section')},100)" class="nav-link">Features</a>
                    <a href="#home" onclick="setTimeout(function(){scrollToSection('faq-section')},100)" class="nav-link">FAQ</a>
                    ${isAdmin() ? '<a href="#admin" class="nav-link admin-nav-link" data-page="admin">🛠 Admin</a>' : ''}
                </nav>

                <div class="header-actions">
                    <!-- Theme Toggle -->
                    <button class="theme-toggle-btn" onclick="toggleTheme()" id="themeToggleBtn" aria-label="Toggle Dark/Light Mode" title="Toggle Theme">
                        <span class="theme-toggle-track">
                            <span class="theme-icon sun-icon">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                            </span>
                            <span class="theme-icon moon-icon">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            </span>
                            <span class="theme-toggle-thumb"></span>
                        </span>
                    </button>

                    ${isLoggedIn ? `
                        <div class="header-avatar" onclick="toggleAvatarDropdown()" id="headerAvatar" title="${userName}">
                            ${initials}
                            <div class="avatar-dropdown" id="avatarDropdown">
                                <div class="dropdown-header">
                                    <div class="dropdown-name">${userName}</div>
                                    <div class="dropdown-email">${userEmail || userGrade}</div>
                                </div>
                                <button class="dropdown-item" onclick="navigate('profile')">
                                    <span>👤</span> My Profile
                                </button>
                                ${isAdmin() ? `<button class="dropdown-item" onclick="navigate('admin')"><span>🛠</span> Admin</button>` : ''}
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item danger" onclick="handleLogout()">
                                    <span>🚪</span> Sign Out
                                </button>
                            </div>
                        </div>
                    ` : `
                        <a href="#login" class="btn btn-outline btn-sm" id="headerLoginBtn">Sign In</a>
                        <a href="#register" class="btn btn-primary btn-sm" id="headerRegisterBtn">Create Account</a>
                    `}
                    <button class="mobile-menu-btn" onclick="toggleMobileMenu()" aria-label="Menu">☰</button>
                </div>
            </div>
        </header>

        <!-- Mobile Menu -->
        <div class="mobile-menu-overlay ${mobileMenuOpen ? 'show' : ''}" id="mobileOverlay" onclick="closeMobileMenu()"></div>
        <div class="mobile-menu ${mobileMenuOpen ? 'show' : ''}" id="mobileMenu">
            <div class="mobile-menu-header">
                <a href="#home" class="header-logo" onclick="closeMobileMenu()">
                    <div class="header-logo-icon">
                        <svg class="header-logo-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14,6 C14,16 34,16 34,24 C34,32 14,32 14,42" stroke="#06B6D4" stroke-width="2.6" stroke-linecap="round" fill="none"/>
                            <path d="M34,6 C34,16 14,16 14,24 C14,32 34,32 34,42" stroke="#10B981" stroke-width="2.6" stroke-linecap="round" fill="none"/>
                            <line x1="14" y1="6" x2="34" y2="6" stroke="#06B6D4" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
                            <line x1="34" y1="24" x2="14" y2="24" stroke="#10B981" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
                            <line x1="14" y1="42" x2="34" y2="42" stroke="#06B6D4" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>
                            <circle cx="14" cy="6" r="2.3" fill="#06B6D4"/>
                            <circle cx="34" cy="6" r="2.3" fill="#10B981"/>
                            <circle cx="34" cy="24" r="2.3" fill="#06B6D4"/>
                            <circle cx="14" cy="24" r="2.3" fill="#10B981"/>
                            <circle cx="14" cy="42" r="2.3" fill="#06B6D4"/>
                            <circle cx="34" cy="42" r="2.3" fill="#10B981"/>
                        </svg>
                    </div>
                    <div>
                        <div class="header-logo-text">${SITE_CONFIG.name}</div>
                    </div>
                </a>
                <button class="mobile-menu-close" onclick="closeMobileMenu()">✕</button>
            </div>
            <nav class="mobile-menu-nav">
                <a href="#home" class="mobile-nav-link" data-page="home" onclick="closeMobileMenu()">
                    <span class="icon">🏠</span> Home
                </a>
                <a href="#courses" class="mobile-nav-link" data-page="courses" onclick="closeMobileMenu()">
                    <span class="icon">📚</span> Courses
                </a>
                <a href="#home" class="mobile-nav-link" onclick="closeMobileMenu(); setTimeout(function(){scrollToSection('courses-section')},150)">
                    <span class="icon">🎓</span> All Courses
                </a>
                <a href="#home" class="mobile-nav-link" onclick="closeMobileMenu(); setTimeout(function(){scrollToSection('features-section')},150)">
                    <span class="icon">✨</span> Platform Features
                </a>
                <a href="#home" class="mobile-nav-link" onclick="closeMobileMenu(); setTimeout(function(){scrollToSection('faq-section')},150)">
                    <span class="icon">❓</span> FAQ
                </a>
                ${isLoggedIn ? `
                    <a href="#profile" class="mobile-nav-link" data-page="profile" onclick="closeMobileMenu()">
                        <span class="icon">👤</span> My Profile
                    </a>
                    ${isAdmin() ? `<a href="#admin" class="mobile-nav-link admin-nav-link" data-page="admin" onclick="closeMobileMenu()"><span class="icon">🛠</span> Admin</a>` : ''}
                ` : ''}
            </nav>
            <div class="mobile-menu-footer">
                ${isLoggedIn ? `
                    <button class="btn btn-outline btn-block" onclick="handleLogout(); closeMobileMenu();">Sign Out</button>
                ` : `
                    <a href="#login" class="btn btn-primary btn-block" onclick="closeMobileMenu()">Sign In</a>
                    <a href="#register" class="btn btn-outline btn-block" onclick="closeMobileMenu()">Create Account</a>
                `}
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════════════════
    function renderFooter() {
        return `
        <div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <div class="footer-logo">
                        <div class="footer-logo-icon">🧬</div>
                        <span class="footer-logo-text">${SITE_CONFIG.fullName}</span>
                    </div>
                    <p>${SITE_CONFIG.description}</p>
                    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                        <span class="badge badge-primary">Class of 2026</span>
                        <span class="badge badge-accent">Foundation &amp; Comprehensive Content</span>
                    </div>
                </div>
                <div class="footer-col">
                    <h4>Quick Links</h4>
                    <a href="#home">Home</a>
                    <a href="#courses">All Courses</a>
                    <a href="#home" onclick="scrollToSection('courses-section')">Courses</a>
                    <a href="#home" onclick="scrollToSection('faq-section')">FAQ</a>
                    ${!isLoggedIn ? '<a href="#register">Create Account</a>' : '<a href="#profile">My Profile</a>'}
                </div>
                <div class="footer-col">
                    <h4>Grade Levels</h4>
                    <a href="#courses" onclick="filterHomeStage('تالتة ثانوي')">3rd Year Secondary</a>
                    <a href="#courses" onclick="filterHomeStage('تانية ثانوي')">2nd Year Secondary</a>
                    <a href="#courses" onclick="filterHomeStage('أولى ثانوي')">1st Year Secondary</a>
                    <a href="#courses" onclick="filterHomeStage('بكالوريا عام برمجة')">Baccalaureate Programming</a>
                    <a href="#courses" onclick="filterHomeStage('أولى إعدادي')">1st Year Preparatory</a>
                    <a href="#courses" onclick="filterHomeStage('تانية إعدادي')">2nd Year Preparatory</a>
                    <a href="#courses" onclick="filterHomeStage('تالتة إعدادي')">3rd Year Preparatory</a>
                    <a href="#courses" onclick="filterHomeStage('مجاني')">Free Courses 🎁</a>
                </div>
                <div class="footer-col">
                    <h4>Contact Us</h4>
                    <a href="https://wa.me/201000000000" target="_blank" rel="noopener">📱 WhatsApp Support</a>
                    <a href="#" target="_blank" rel="noopener">💬 Telegram Channel</a>
                    <a href="#" target="_blank" rel="noopener">📘 Facebook Page</a>
                    <a href="#login">🔑 Student Login</a>
                </div>
            <div class="footer-bottom">
                <div class="footer-copy">
                    <span>&copy; ${SITE_CONFIG.year} ${SITE_CONFIG.fullName}. All rights reserved.</span>
                </div>
                <div class="footer-dev-credit">
                    <span>Designed &amp; developed by</span>
                    <a href="https://wa.me/201001352771" target="_blank" rel="noopener noreferrer" class="dev-name-link">
                        <span class="dev-badge">Dev</span> Ahmed Amr Abu El-Hag
                    </a>
                    <button class="footer-admin-btn" onclick="openDashModal()" title="Admin">Admin</button>
                </div>
                <div class="footer-social">
                    <a href="https://wa.me/201000000000" target="_blank" rel="noopener" aria-label="WhatsApp" title="WhatsApp">💬</a>
                    <a href="#" aria-label="Telegram" title="Telegram">✈️</a>
                    <a href="#" aria-label="Facebook" title="Facebook">📘</a>
                </div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // SKELETON CARDS — تُعرض فوراً ريثما تصل الكورسات من Firebase
    // ═══════════════════════════════════════════════════════════
    function renderSkeletonCards(count) {
        count = count || 6;
        var card = '<div class="pcc-skeleton">' +
            '<div class="sk-image"></div>' +
            '<div class="sk-body">' +
            '<div class="sk-line sk-badge"></div>' +
            '<div class="sk-line sk-title"></div>' +
            '<div class="sk-line sk-title2"></div>' +
            '<div class="sk-line sk-meta"></div>' +
            '<div class="sk-line sk-btn"></div>' +
            '</div></div>';
        var html = '';
        for (var i = 0; i < count; i++) html += card;
        return html;
    }

    // ═══════════════════════════════════════════════════════════
    // HOME PAGE
    // ═══════════════════════════════════════════════════════════
    function renderHomePage() {
        const allCourses = getAllCourses();
        const coursesHTML = allCourses.length
            ? allCourses.map((c, i) => renderCourseCard(c, i)).join('')
            : renderSkeletonCards(6);

        return `
        <!-- ═══ HERO BANNER — بيج فاتح أنيق ═══ -->
        <section id="homeHeroBanner" class="hb-section">

            <!-- خلفية زخرفية -->
            <div class="hb-bg" aria-hidden="true">
                <div class="hb-orb hb-orb-1"></div>
                <div class="hb-orb hb-orb-2"></div>
                <span class="hb-float hb-f1">🧬 DNA</span>
                <span class="hb-float hb-f2">RNA</span>
                <span class="hb-float hb-f3">O₂ ⇌ CO₂</span>
                <span class="hb-float hb-f4">🔬 Cell</span>
                <span class="hb-float hb-f5">ATP</span>
                <span class="hb-float hb-f6">Mitosis</span>
            </div>

            <div class="hb-container">
                <div class="hb-body">

                    <!-- Photo Side -->
                    <div class="hb-img-side">
                        <h1 class="hb-heading">
                            <span class="hb-h-prefix">Biology with</span>
                            <span class="hb-h-name">Mr. Islam Abdelwahed</span>
                            <span class="hb-h-suffix">Secondary &amp; Preparatory</span>
                        </h1>
                        <div class="hb-img-frame">
                            <div class="hb-img-glow" aria-hidden="true"></div>
                            <img src="teacher-new.jpg?v=20260912" alt="Mr. Islam Abdelwahed" class="hb-img" loading="eager" onerror="this.src='صورة المدرس الجديد.jpeg'">
                            <div class="hb-img-caption">
                                <span class="hb-img-badge">🧬 Biology Teacher</span>
                            </div>
                        </div>
                    </div>

                    <!-- الأزرار — يمين -->
                    <div class="hb-text-side">
                        <div class="hb-btns">
                            <a href="#register" class="hb-btn-orange">
                                <span>✨ Create Account Now</span>
                                <span class="hb-arrow">→</span>
                            </a>
                            <a href="#courses" class="hb-btn-green">
                                <span>📚 Explore Courses</span>
                            </a>
                        </div>
                    </div>

                </div>
            </div>
        </section>

        <!-- Courses Section — مباشرة بعد البنر -->
        <section class="page-section home-courses-section" id="courses-section">
            <div class="container">
                <div class="home-courses-header">
                    <span class="section-badge"><span class="icon">📚</span> Available Courses</span>
                    <h2 class="section-title">Platform Courses</h2>

                    <!-- Search & Filters -->
                    <div class="home-search-box">
                        <span class="home-search-icon">🔍</span>
                        <input type="text" class="home-search-input" id="homeCourseSearch" placeholder="Search by course name or grade..." oninput="handleHomeSearch(this.value)">
                    </div>

                    <div class="filter-chips">
                        <button class="filter-chip active" data-grade="الكل" onclick="filterHomeStage('الكل', this)">All</button>
                        <button class="filter-chip" data-grade="أولى ثانوي" onclick="filterHomeStage('أولى ثانوي', this)">1st Sec</button>
                        <button class="filter-chip" data-grade="تانية ثانوي" onclick="filterHomeStage('تانية ثانوي', this)">2nd Sec</button>
                        <button class="filter-chip" data-grade="تالتة ثانوي" onclick="filterHomeStage('تالتة ثانوي', this)">3rd Sec</button>
                        <button class="filter-chip" data-grade="بكالوريا عام برمجة" onclick="filterHomeStage('بكالوريا عام برمجة', this)">Baccalaureate</button>
                        <button class="filter-chip" data-grade="أولى إعدادي" onclick="filterHomeStage('أولى إعدادي', this)">1st Prep</button>
                        <button class="filter-chip" data-grade="تانية إعدادي" onclick="filterHomeStage('تانية إعدادي', this)">2nd Prep</button>
                        <button class="filter-chip" data-grade="تالتة إعدادي" onclick="filterHomeStage('تالتة إعدادي', this)">3rd Prep</button>
                        <button class="filter-chip" data-grade="مجاني" onclick="filterHomeStage('مجاني', this)">🎁 Free</button>
                    </div>
                </div>

                <div class="courses-grid premium-courses-grid" id="homeCoursesGrid">
                    ${coursesHTML}
                </div>

                <div class="empty-state" id="homeCoursesEmpty" style="display:none;margin-top:var(--space-xl);">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No Matching Courses</h3>
                    <p>Try searching with another keyword or selecting a different grade.</p>
                </div>
            </div>
        </section>

        <!-- Features / Why Choose Us -->
        <section class="page-section" id="features-section">
            <div class="container text-center">
                <span class="section-badge"><span class="icon">✨</span> Why Mr. Islam Abdelwahed?</span>
                <h2 class="section-title">Everything You Need for Full Marks &amp; Excellence</h2>
                <p class="section-subtitle">A comprehensive learning environment tailored to help you excel with maximum efficiency.</p>
                <div class="features-grid">
                    ${FEATURES_DATA.map((f, i) => `
                        <div class="feature-card reveal reveal-delay-${(i % 3) + 1}">
                            <div class="feature-icon ${f.colorClass}">${f.icon}</div>
                            <h3>${f.title}</h3>
                            <p>${f.description}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>

        <!-- 3-Step Roadmap -->
        <section class="page-section" style="background:var(--bg-alt);">
            <div class="container text-center">
                <span class="section-badge"><span class="icon">🚀</span> Easy Start</span>
                <h2 class="section-title">How to Start Your Journey in 3 Steps</h2>
                <p class="section-subtitle">Simple and fast steps to get started in just a few minutes.</p>
                <div class="steps-grid">
                    <div class="step-card reveal">
                        <div class="step-badge">1</div>
                        <div class="step-icon">👤</div>
                        <h3>Create Free Account</h3>
                        <p>Register your name, phone number, and grade level in under a minute.</p>
                    </div>
                    <div class="step-card reveal reveal-delay-1">
                        <div class="step-badge">2</div>
                        <div class="step-icon">🔑</div>
                        <h3>Choose Your Course</h3>
                        <p>Browse courses, start with the free foundation course, or activate your grade's course code.</p>
                    </div>
                    <div class="step-card reveal reveal-delay-2">
                        <div class="step-badge">3</div>
                        <div class="step-icon">🏆</div>
                        <h3>Learn, Practice &amp; Excel!</h3>
                        <p>Watch lectures, solve exercises and online exams, and achieve the full mark.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Teacher Bio Section -->
        <section class="page-section">
            <div class="container">
                <div class="teacher-section-card reveal">
                    <div class="teacher-visual">
                        <div class="teacher-avatar-circle">👨‍🏫</div>
                        <div class="teacher-name-badge">${SITE_CONFIG.teacher}</div>
                        <div class="teacher-role-badge">Biology Expert &amp; Teacher for Secondary &amp; Preparatory</div>
                    </div>
                    <div class="teacher-content">
                        <span class="section-badge"><span class="icon">⭐</span> Lead Instructor</span>
                        <h2>Making Biology Clear, Intuitive &amp; Inspiring</h2>
                        <p>
                            "My core mission is not merely to help students memorize, but to build a true biological mindset that understands how living systems work and connects every concept to real life. Over 15+ years, I have proudly guided thousands of students to top faculties and full marks."
                        </p>
                        <div class="teacher-pills">
                            <div class="teacher-pill"><span>🏆</span> 15+ Years Experience</div>
                            <div class="teacher-pill"><span>🎯</span> Top Nationwide Ranks</div>
                            <div class="teacher-pill"><span>🔬</span> Exclusive Simplified Method</div>
                            <div class="teacher-pill"><span>⚡</span> Personal Homework Follow-up</div>
                        </div>
                        <div style="display:flex;gap:12px;flex-wrap:wrap;">
                            <a href="#courses" class="btn btn-primary btn-lg">Browse Courses &rarr;</a>
                            <a href="https://wa.me/201000000000" target="_blank" rel="noopener" class="btn btn-outline btn-lg">💬 Contact Mr. Islam</a>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Testimonials Section -->
        <section class="page-section" style="background:var(--bg-alt);">
            <div class="container text-center">
                <span class="section-badge"><span class="icon">💬</span> Student Reviews</span>
                <h2 class="section-title">What Our Students &amp; Parents Say</h2>
                <p class="section-subtitle">Real success stories of students who turned Biology into their greatest strength.</p>
                <div class="testimonials-grid">
                    ${TESTIMONIALS_DATA.map((t, i) => `
                        <div class="testimonial-card reveal reveal-delay-${(i % 3) + 1}">
                            <div class="testimonial-stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
                            <p class="testimonial-text">"${t.text}"</p>
                            <div class="testimonial-author">
                                <div class="testimonial-avatar">${t.initials}</div>
                                <div>
                                    <div class="testimonial-name">${t.name}</div>
                                    <div class="testimonial-grade">${t.grade}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>

        <!-- FAQ Section -->
        <section class="page-section" id="faq-section">
            <div class="container text-center">
                <span class="section-badge"><span class="icon">❓</span> Help &amp; Info</span>
                <h2 class="section-title">Frequently Asked Questions</h2>
                <p class="section-subtitle">Everything you need to know about registration, course activation, and using the platform.</p>
                <div class="faq-grid">
                    ${FAQ_DATA.map((faq, idx) => `
                        <div class="faq-item ${idx === 0 ? 'open' : ''}" id="faq-item-${idx}">
                            <button class="faq-question" onclick="toggleFaq(${idx})">
                                <span>${faq.q}</span>
                                <span class="faq-icon">▼</span>
                            </button>
                            <div class="faq-answer">
                                <p>${faq.a}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>

        <!-- Final CTA Banner -->
        <section class="cta-section">
            <div class="container text-center">
                <h2 class="reveal">Ready to Excel in Biology with Mr. Islam Abdelwahed?</h2>
                <p class="reveal reveal-delay-1">Join thousands of students and experience an engaging learning journey that makes all the difference.</p>
                <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:var(--space-xl);">
                    ${isLoggedIn ? `
                        <a href="#dashboard" class="btn btn-accent btn-xl reveal reveal-delay-2">📊 Go to Dashboard &rarr;</a>
                        <a href="#courses" class="btn btn-outline btn-xl reveal reveal-delay-2" style="border-color:#fff;color:#fff;">📚 Explore Courses</a>
                    ` : `
                        <a href="#register" class="btn btn-accent btn-xl reveal reveal-delay-2" id="ctaBannerRegisterBtn">✨ Create Free Account Now &rarr;</a>
                        <a href="#login" class="btn btn-outline btn-xl reveal reveal-delay-2" style="border-color:#fff;color:#fff;">🔑 Sign In</a>
                    `}
                </div>
            </div>
        </section>

        <!-- Instructor Signature Banner -->
        <section class="instructor-banner-section">
            <div class="container">
                <div class="instructor-banner-eyebrow reveal">
                    <span class="instructor-banner-badge">🧬 هوية المنصة</span>
                </div>
                <div class="instructor-banner-card reveal reveal-delay-1">
                    <svg class="ibs-dna ibs-dna-left" viewBox="0 0 120 400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20,10 C20,60 100,60 100,110 C100,160 20,160 20,210 C20,260 100,260 100,310 C100,360 20,360 20,390" stroke="#22D3EE" stroke-width="3" fill="none" opacity="0.5"/>
                        <path d="M100,10 C100,60 20,60 20,110 C20,160 100,160 100,210 C100,260 20,260 20,310 C20,360 100,360 100,390" stroke="#6EE7B7" stroke-width="3" fill="none" opacity="0.5"/>
                    </svg>
                    <img src="instructor-banner.jpg?v=20260921" alt="الخلية — أ/ إسلام عبدالواحد — معا نحو القمة" class="instructor-banner-img" loading="lazy">
                    <svg class="ibs-dna ibs-dna-right" viewBox="0 0 120 400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20,10 C20,60 100,60 100,110 C100,160 20,160 20,210 C20,260 100,260 100,310 C100,360 20,360 20,390" stroke="#6EE7B7" stroke-width="3" fill="none" opacity="0.5"/>
                        <path d="M100,10 C100,60 20,60 20,110 C20,160 100,160 100,210 C100,260 20,260 20,310 C20,360 100,360 100,390" stroke="#22D3EE" stroke-width="3" fill="none" opacity="0.5"/>
                    </svg>
                </div>
            </div>
        </section>

        <!-- Floating WhatsApp Support Button -->
        <a href="https://wa.me/201000000000" target="_blank" rel="noopener" class="floating-support-btn" title="Contact us via WhatsApp">
            <span class="floating-support-icon">💬</span>
            <span>Contact Support</span>
        </a>
        `;
    }

    // ═══════════════════════════════════════════════════════════
    // COURSES PAGE
    // ═══════════════════════════════════════════════════════════
    function renderCoursesPage() {
        const allCourses = getAllCourses();
        const grades = ['All', ...new Set(allCourses.map(c => c.gradeTag).filter(Boolean))];
        const coursesHTML = allCourses.length
            ? allCourses.map((c, i) => renderCourseCard(c, i)).join('')
            : renderSkeletonCards(8);
        return `
        <div style="padding-top:calc(var(--header-height) + var(--space-2xl));padding-bottom:var(--space-3xl);">
            <div class="container">
                <div class="text-center" style="margin-bottom:var(--space-2xl);">
                    <span class="section-badge"><span class="icon">📚</span> Courses</span>
                    <h2 class="section-title">All Available Courses</h2>
                    <p class="section-subtitle">Choose your grade level and explore courses available for you.</p>
                </div>
                <div class="courses-filter-bar">
                    <div class="filter-search">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="courseSearchInput" placeholder="Search for a course..." oninput="filterCourses()">
                    </div>
                    <div class="filter-chips" id="filterChips">
                        ${grades.map((g, i) => `
                            <button class="filter-chip ${i === 0 ? 'active' : ''}" data-grade="${g}" onclick="filterByGrade('${g}', this)">${g === 'الكل' ? 'All' : g}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="courses-grid" id="coursesGrid">
                    ${coursesHTML}
                </div>
                <div class="empty-state" id="coursesEmpty" style="display:none;">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No Results Found</h3>
                    <p>Try changing your search keyword or grade filter.</p>
                </div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // COURSE CARD COMPONENT
    // ═══════════════════════════════════════════════════════════
    function renderCourseCard(course, index) {
        const isEnrolled = isLoggedIn && currentUser && (currentUser.enrolledCourses || []).some(
            id => String(id) === String(course.id)
        );

        let actionBtnText = 'Enter Course →';
        let actionBtnClass = 'btn-primary';

        if (course.isFree) {
            actionBtnText = '🎁 Start Free';
            actionBtnClass = 'btn-accent';
        } else if (isEnrolled) {
            actionBtnText = '▶️ Continue Course';
            actionBtnClass = 'btn-primary';
        } else {
            actionBtnText = '🔓 Activate Course';
            actionBtnClass = 'btn-primary';
        }

        // تحديد مصدر الصورة: صورة مرفوعة أو placeholder احترافي
        const imgSrc = (course.thumbnail && course.thumbnail.trim()) ||
            (course.thumb && course.thumb.trim()) ||
            (course.image && course.image.trim()) || '';
        const hasImage = imgSrc !== '';
        const icon = course.icon || course.emoji || '📚';
        const imageContent = hasImage
            ? `<img src="${imgSrc}" alt="${course.title}" class="pcc-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="pcc-img-fallback" style="display:none;"><div class="pcc-fallback-glow"></div><div class="pcc-fallback-icon">${icon}</div></div>`
            : `<div class="pcc-img-fallback"><div class="pcc-fallback-glow"></div><div class="pcc-fallback-icon">${icon}</div></div>`;

        const gradeKey = course.gradeTag || course.grade || '';

        return `
        <div class="course-card pcc-wrap reveal visible reveal-delay-${(index % 4) + 1}" onclick="navigate('course/${course.id}')" data-grade="${gradeKey}" data-free="${course.isFree ? 'true' : 'false'}" title="${course.title}">
            <!-- صورة الكورس — 70% -->
            <div class="pcc-image-zone">
                ${imageContent}
                <div class="pcc-overlay"></div>
                <div class="pcc-top-badges">
                    <span class="pcc-badge ${course.isFree ? 'pcc-badge-free' : 'pcc-badge-grade'}">${course.isFree ? '🎁 Free' : course.gradeTag}</span>
                    ${isEnrolled ? '<span class="pcc-badge pcc-badge-enrolled">✅ Enrolled</span>' : ''}
                </div>
                <div class="pcc-rating-chip">⭐ ${course.rating || 5.0}</div>
            </div>

            <!-- معلومات الكورس — 30% -->
            <div class="pcc-info-zone">
                <div class="pcc-grade-line">📌 ${course.grade || gradeKey}${course.term ? ' — ' + course.term : ''}</div>
                <h3 class="pcc-title">${course.title}</h3>
                <div class="pcc-meta-row">
                    <span class="pcc-meta-chip">📚 ${course.lessonsCount || 0} Lessons</span>
                    <span class="pcc-meta-chip">⏱️ ${course.duration || '—'}</span>
                </div>
                <div class="pcc-footer">
                    <div class="pcc-price ${course.isFree ? 'pcc-price-free' : ''}">
                        ${course.isFree ? 'Free 🎁' : course.price + ' <span class="pcc-currency">' + (course.currency || 'EGP') + '</span>'}
                    </div>
                    <button class="pcc-action-btn pcc-action-${course.isFree ? 'free' : (isEnrolled ? 'enrolled' : 'lock')}" onclick="event.stopPropagation(); openCourse('${course.id}')">
                        ${actionBtnText}
                    </button>
                </div>
            </div>
        </div>`;
    }

    function normalizeContentKey(value) {
        return String(value || '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[?&]autoplay=false\b/g, '')
            .replace(/\/$/, '')
            .toLowerCase();
    }

    function getLessonUniqueKey(lesson) {
        if (!lesson) return '';
        const bunnyId = normalizeContentKey(lesson.bunnyVideoId);
        const videoUrl = normalizeContentKey(lesson.videoUrl || lesson.content);
        const pdfUrl = normalizeContentKey(lesson.pdfUrl);
        const quizId = normalizeContentKey(lesson.quizId);
        if (bunnyId) return 'bunny:' + bunnyId;
        if (videoUrl) return 'video:' + videoUrl;
        if (pdfUrl) return 'pdf:' + pdfUrl;
        if (quizId) return 'quiz:' + quizId;
        return 'title:' + normalizeContentKey((lesson.type || 'video') + '|' + (lesson.title || ''));
    }

    function sanitizeEffectivePackages(packages) {
        const seenLessons = new Set();
        const seenTitles = new Set();
        return (packages || []).map((pkg, pi) => {
            const lessons = Array.isArray(pkg.lessons) ? pkg.lessons : [];
            const cleanLessons = lessons.filter((lesson) => {
                const key = getLessonUniqueKey(lesson);
                const titleKey = normalizeContentKey((lesson.type || 'video') + '|' + (lesson.title || ''));
                if (!key || seenLessons.has(key) || (titleKey && seenTitles.has(titleKey))) return false;
                seenLessons.add(key);
                if (titleKey) seenTitles.add(titleKey);
                return true;
            }).map((lesson, li) => Object.assign({}, lesson, {
                isLocked: lesson.isLocked && li > 0
            }));
            return Object.assign({}, pkg, {
                lessons: cleanLessons,
                title: pkg.title || ('Lesson ' + (pi + 1))
            });
        }).filter(pkg => pkg.lessons.length > 0);
    }

    function sanitizeLessonSegments(segments) {
        const seen = new Set();
        return (Array.isArray(segments) ? segments : []).filter((segment) => {
            if (!segment) return false;
            const bunnyId = normalizeContentKey(segment.bunnyVideoId);
            const videoUrl = normalizeContentKey(segment.videoUrl || segment.content);
            if (!bunnyId && !videoUrl) return false;
            const key = bunnyId ? 'bunny:' + bunnyId : 'video:' + videoUrl;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // ═══════════════════════════════════════════════════════════
    // COURSE DETAILS PAGE
    // ═══════════════════════════════════════════════════════════
    function renderCourseDetailsPage(courseId) {
        const course = getAllCourses().find(c => String(c.id) === String(courseId));
        if (!course) return render404Page();

        const effectivePackages = sanitizeEffectivePackages(getEffectiveCoursePackages(course));
        const allLessons = effectivePackages.flatMap(p => p.lessons);
        const completedCount = allLessons.filter(l => l.isCompleted).length;

        return `
        <section class="course-details-hero">
            <div class="container">
                <div class="course-details-info">
                    <span class="section-badge"><span class="icon">📚</span> ${course.grade}</span>
                    <h1>${course.title}</h1>
                    <p class="course-desc-hero">${course.description}</p>
                    <div class="course-details-meta">
                        <span class="course-detail-meta-item"><span class="icon">👨‍🏫</span> ${SITE_CONFIG.teacher}</span>
                        <span class="course-detail-meta-item"><span class="icon">📚</span> ${allLessons.length} Lessons</span>
                        <span class="course-detail-meta-item"><span class="icon">⏱️</span> ${course.duration}</span>
                        <span class="course-detail-meta-item"><span class="icon">👨‍🎓</span> ${course.studentsCount} Students</span>
                        <span class="course-detail-meta-item"><span class="icon">⭐</span> ${course.rating}</span>
                    </div>
                </div>
                <div class="course-sidebar-card">
                    <div class="price-section">
                        <div class="price-big ${course.isFree ? 'course-price-free' : ''}">
                            ${course.isFree ? 'Free' : course.price + ' <span class="currency">' + course.currency + '</span>'}
                        </div>
                        <button class="btn btn-accent btn-block btn-lg" onclick="openCourse('${course.id}')">
                            ${course.isFree ? 'Start Free Now' : 'Enter Course'}
                        </button>
                    </div>
                    <div class="sidebar-details">
                        <div class="sidebar-detail-row">
                            <span class="label">📚 Total Lessons</span>
                            <span class="value">${allLessons.length} Lessons</span>
                        </div>
                        <div class="sidebar-detail-row">
                            <span class="label">⏱️ Duration</span>
                            <span class="value">${course.duration}</span>
                        </div>
                        <div class="sidebar-detail-row">
                            <span class="label">📊 Grade Level</span>
                            <span class="value">${course.gradeTag}</span>
                        </div>
                        <div class="sidebar-detail-row">
                            <span class="label">🎓 Certificate</span>
                            <span class="value">Available</span>
                        </div>
                        <div class="sidebar-detail-row">
                            <span class="label">📱 Access</span>
                            <span class="value">Full Term</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="course-content-section">
            <div class="container">
                <div class="course-tabs" id="courseTabs">
                    <button class="course-tab active" data-tab="curriculum" onclick="switchCourseTab('curriculum', this)">Curriculum</button>
                    <button class="course-tab" data-tab="overview" onclick="switchCourseTab('overview', this)">Overview</button>
                    <button class="course-tab" data-tab="reviews" onclick="switchCourseTab('reviews', this)">Reviews</button>
                </div>

                <div id="tab-curriculum">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
                        <h3>${effectivePackages.length} Main Units - ${allLessons.length} Topics</h3>
                        <span class="badge badge-primary">${completedCount} / ${allLessons.length || 1} Completed</span>
                    </div>
                    ${effectivePackages.map((pkg, pi) => `
                        <div class="curriculum-package">
                            <div class="package-header ${pi === 0 ? 'open' : ''}" onclick="togglePackage(this)">
                                <h4>📦 ${pkg.title}</h4>
                                <div style="display:flex;align-items:center;gap:12px;">
                                    <span class="lesson-count">${pkg.lessons.length} Topics</span>
                                    <span class="toggle-icon">▼</span>
                                </div>
                            </div>
                            <div class="package-lessons ${pi === 0 ? 'open' : ''}">
                                ${pkg.lessons.map(lesson => `
                                    <div class="lesson-item" onclick="openLesson('${course.id}', '${lesson.id}')">
                                        <div class="lesson-icon ${lesson.type}">
                                            ${lesson.type === 'video' ? '▶️' : lesson.type === 'quiz' ? '📝' : '📄'}
                                        </div>
                                        <div class="lesson-info">
                                            <div class="lesson-title">${lesson.title}</div>
                                            <div class="lesson-meta">${lesson.type === 'video' ? 'Video' : lesson.type === 'quiz' ? 'Exam' : 'PDF File'} - ${lesson.duration}</div>
                                        </div>
                                        <span class="lesson-status ${lesson.isCompleted ? 'completed' : lesson.isLocked ? 'locked' : ''}">
                                            ${lesson.isCompleted ? '✅' : lesson.isLocked ? '🔒' : 'O'}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div id="tab-overview" style="display:none;">
                    <div class="card card-flat" style="padding:var(--space-xl);">
                        <h3 style="margin-bottom:var(--space-md);">About This Course</h3>
                        <p style="line-height:2;margin-bottom:var(--space-lg);">${course.description}</p>
                        <h4 style="margin-bottom:var(--space-md);">What You Will Learn</h4>
                        <ul style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                            <li style="display:flex;align-items:center;gap:8px;font-size:0.92rem;">✅ Understand core biological concepts</li>
                            <li style="display:flex;align-items:center;gap:8px;font-size:0.92rem;">✅ Systematic problem-solving techniques</li>
                            <li style="display:flex;align-items:center;gap:8px;font-size:0.92rem;">✅ Real exam practice &amp; timed tests</li>
                            <li style="display:flex;align-items:center;gap:8px;font-size:0.92rem;">✅ Comprehensive final term revision</li>
                        </ul>
                    </div>
                </div>

                <div id="tab-reviews" style="display:none;">
                    <div class="testimonials-grid" style="grid-template-columns:1fr;">
                        ${TESTIMONIALS_DATA.slice(0, 3).map(t => `
                            <div class="testimonial-card" style="text-align:left;">
                                <div class="testimonial-stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
                                <p class="testimonial-text">"${t.text}"</p>
                                <div class="testimonial-author">
                                    <div class="testimonial-avatar">${t.initials}</div>
                                    <div>
                                        <div class="testimonial-name">${t.name}</div>
                                        <div class="testimonial-grade">${t.grade}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </section>`;
    }

    // ═══════════════════════════════════════════════════════════
    // LICENSE PAGE — Accordion: Packages -> Lessons (Clips)
    // ═══════════════════════════════════════════════════════════
    function renderLicensePage(courseId) {
        // غير مسجل الدخول → حفظ الوجهة وتوجيه مباشر
        if (!isLoggedIn) {
            sessionStorage.setItem('iraqiplatform_redirect', 'license/' + courseId);
            return renderAuthRequiredPage(courseId);
        }

        const course = getAllCourses().find(c => String(c.id) === String(courseId));
        if (!course) return render404Page();

        const effectivePackages = sanitizeEffectivePackages(getEffectiveCoursePackages(course));
        const allLessons = effectivePackages.flatMap(p => p.lessons);
        const isEnrolled = (currentUser.enrolledCourses || []).some(
            id => String(id) === String(courseId)
        );
        const isFreeOrEnrolled = course.isFree || isEnrolled;
        const firstLessonId = allLessons[0] ? allLessons[0].id : '';

        // إذا كان الطالب مشتركاً بالفعل في الكورس أو الكورس مجاني → تحويل تلقائي فوري للمحاضرة الأولى
        if (isFreeOrEnrolled && firstLessonId) {
            setTimeout(function () {
                navigate('lesson/' + courseId + '/' + firstLessonId);
            }, 20);
            return `
            <div style="padding-top:calc(var(--header-height) + var(--space-3xl));min-height:75vh;display:flex;align-items:center;justify-content:center;">
                <div style="text-align:center;padding:36px 32px;background:var(--bg-surface);border-radius:24px;border:1px solid var(--border);box-shadow:0 12px 36px rgba(0,0,0,0.08);max-width:460px;margin:0 16px;">
                    <div style="font-size:3.2rem;margin-bottom:14px;">🚀</div>
                    <h3 style="font-size:1.35rem;font-weight:900;margin-bottom:8px;color:var(--text-primary);">Opening the first lesson...</h3>
                    <p style="color:var(--text-secondary);font-size:0.92rem;margin-bottom:24px;line-height:1.7;">You are enrolled in this course. Preparing the lesson player now.</p>
                    <a href="#lesson/${courseId}/${firstLessonId}" class="btn btn-primary btn-lg btn-block" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;">
                        <span>▶</span> Enter First Lesson Directly
                    </a>
                </div>
            </div>`;
        }

        return `
        <div style="padding-top:calc(var(--header-height) + var(--space-xl));padding-bottom:var(--space-3xl);">
            <div class="container">

                <!-- Course Header -->
                <div class="license-course-header reveal" style="margin-bottom:var(--space-xl); background:var(--bg-surface); padding:28px 32px; border-radius:24px; border:1px solid var(--border); box-shadow:0 4px 24px rgba(0,0,0,0.04);">
                    <div class="license-course-meta">
                        <a href="#courses" class="btn btn-ghost btn-sm" style="margin-bottom:var(--space-md); border:1px solid var(--border); border-radius:10px; font-weight:800;">&larr; Back to Courses</a>

                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
                            <span class="badge ${course.isFree ? 'badge-success' : 'badge-primary'}" style="padding:6px 14px; border-radius:8px; font-size:0.8rem; font-weight:900; letter-spacing:0.5px;">
                                ${course.isFree ? '🎁 Free' : course.gradeTag}
                            </span>
                            ${course.term ? `<span class="badge badge-accent" style="padding:6px 14px; border-radius:8px; font-size:0.8rem; font-weight:900;">${course.term}</span>` : ''}
                        </div>

                        <h1 style="font-size:2.1rem; font-weight:900; color:var(--text-primary); margin-bottom:14px; line-height:1.3;">${course.title}</h1>

                        <div style="background:var(--bg-alt); padding:16px 20px; border-radius:14px; border-left:4px solid var(--primary-500, #06B6D4); margin-bottom:22px;">
                            <p style="color:var(--text-secondary); font-size:1rem; line-height:1.85; margin:0; text-align:justify;">${course.description}</p>
                        </div>

                        <div class="course-details-meta" style="display:flex; flex-wrap:wrap; gap:12px;">
                            <span class="course-detail-meta-item" style="background:var(--bg-alt); padding:8px 14px; border-radius:10px; font-size:0.87rem; font-weight:700;"><span class="icon" style="margin-right:5px;">👨‍🏫</span> ${SITE_CONFIG.teacher}</span>
                            <span class="course-detail-meta-item" style="background:var(--bg-alt); padding:8px 14px; border-radius:10px; font-size:0.87rem; font-weight:700;"><span class="icon" style="margin-right:5px;">📚</span> ${allLessons.length} Topics</span>
                            <span class="course-detail-meta-item" style="background:var(--bg-alt); padding:8px 14px; border-radius:10px; font-size:0.87rem; font-weight:700;"><span class="icon" style="margin-right:5px;">⏱️</span> ${course.duration}</span>
                            <span class="course-detail-meta-item" style="background:var(--bg-alt); padding:8px 14px; border-radius:10px; font-size:0.87rem; font-weight:700;"><span class="icon" style="margin-right:5px;">⭐</span> ${course.rating || 5.0} Rating</span>
                        </div>
                    </div>
                </div>

                ${!isFreeOrEnrolled ? `
                <!-- Activation Card -->
                <div class="iq-prem-act-card reveal" style="margin-bottom:var(--space-2xl);">

                    <!-- Header -->
                    <div class="iq-prem-act-header">
                        <div class="iq-prem-act-lock">🔒</div>
                        <div class="iq-prem-act-header-text">
                            <h3>This course requires activation to access all lectures</h3>
                            <p>Subscription fee: <strong>${course.price || 0} ${course.currency || 'EGP'}</strong> — Choose your activation method:</p>
                        </div>
                    </div>

                    <!-- Options Grid -->
                    <div class="iq-prem-act-grid">

                        <!-- Option 1: Code -->
                        <div class="iq-prem-act-col">
                            <div class="iq-prem-act-col-inner">
                                <div class="iq-prem-opt-header">
                                    <span class="iq-prem-opt-icon">🔑</span>
                                    <h4>Have an activation code? Enter it here</h4>
                                </div>
                                <p class="iq-prem-opt-desc">If you purchased an activation code from the centre or support team, enter it below to activate immediately.</p>
                                <div class="iq-prem-code-form">
                                    <input type="text"
                                           class="iq-prem-code-input"
                                           id="licenseCodeInput"
                                           placeholder="Enter activation code"
                                           maxlength="12"
                                           dir="ltr"
                                           autocomplete="off"
                                           onkeydown="if(event.key==='Enter') activateLicenseCode('${courseId}')">
                                    <button class="iq-prem-code-btn" id="activateLicenseBtn"
                                            onclick="activateLicenseCode('${courseId}')">
                                        Activate Code ✅
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Option 2: Vodafone Cash + WhatsApp -->
                        <div class="iq-prem-act-col iq-prem-act-col--highlight">
                            <div class="iq-prem-act-col-inner">
                                <div class="iq-prem-opt-header">
                                    <span class="iq-prem-opt-icon">💸</span>
                                    <h4>Don't have a code? Request one</h4>
                                </div>
                                <p class="iq-prem-opt-desc">Transfer the fee via Vodafone Cash, then send your details to receive the code instantly.</p>

                                <div class="iq-prem-transfer-steps">
                                    <div class="iq-prem-step-row">
                                        <span class="iq-prem-step-num">1</span>
                                        <span>Transfer fee (<strong>${course.price || 0} EGP</strong>) to:<br>
                                        <span class="iq-prem-vf-num"
                                              onclick="navigator.clipboard && navigator.clipboard.writeText('01220222307').then(function(){ showToast('Number copied', 'success'); })"
                                              title="Click to copy">📱 01220222307 <small>📋</small></span></span>
                                    </div>
                                    <div class="iq-prem-step-row">
                                        <span class="iq-prem-step-num">2</span>
                                        <span>Click below to confirm transfer and receive your code via WhatsApp.</span>
                                    </div>
                                </div>

                                <button class="iq-prem-wa-btn"
                                        onclick="requestActivationWhatsApp('${courseId}', '${(course.title || '').replace(/'/g, "\\'")}', ${course.price || 0})">
                                    <span>💬</span>
                                    Request Code via WhatsApp
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
                ` : `
                <!-- Enrolled banner -->
                <div class="iq-enrolled-banner reveal" style="margin-bottom:var(--space-2xl);">
                    <div style="font-size:3rem;margin-bottom:var(--space-xs);">🎉</div>
                    <h2 style="font-size:1.4rem;font-weight:900;margin-bottom:var(--space-xs);color:var(--text-primary);">You are enrolled in this course!</h2>
                    <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);font-size:0.95rem;">All lectures, files, and exams are fully accessible.</p>
                    <button class="btn btn-primary btn-lg" onclick="navigate('lesson/${courseId}/${firstLessonId}')">
                        ▶ Start Watching First Lesson
                    </button>
                </div>
                `}

                <!-- Accordion: Packages -> Lessons -->
                <div style="margin-top:var(--space-xl);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);gap:12px;flex-wrap:wrap;">
                        <div>
                            <h2 style="margin:0 0 4px;font-size:1.4rem;font-weight:900;">📋 Course Curriculum</h2>
                            <p style="margin:0;font-size:0.85rem;color:var(--text-muted);">${effectivePackages.reduce((t, p) => t + p.lessons.length, 0)} Lectures · ${effectivePackages.length} Units</p>
                        </div>
                    </div>
                    <div class="license-accordion" id="licenseAccordion">
                        ${effectivePackages.map((pkg, pi) => {
            const pkgLessons = pkg.lessons;
            const completedInPkg = pkgLessons.filter(l => l.isCompleted).length;
            return `
                            <div class="accordion-package ${pi === 0 ? 'open' : ''}" id="acc-pkg-${pi}">
                                <div class="accordion-pkg-header" onclick="toggleAccordion(${pi})">
                                    <div class="accordion-pkg-title">
                                        <span class="pkg-badge">${pi + 1}</span>
                                        <span>${pkg.title}</span>
                                    </div>
                                    <div class="accordion-pkg-meta">
                                        <span>${completedInPkg}/${pkgLessons.length} Completed</span>
                                        <span class="lesson-count">${pkgLessons.length} Topics</span>
                                        <span class="accordion-pkg-arrow" id="acc-arrow-${pi}">▼</span>
                                    </div>
                                </div>
                                <div class="accordion-pkg-lessons ${pi === 0 ? 'open' : ''}" id="acc-lessons-${pi}">
                                    ${pkgLessons.map((lesson, li) => {
                const canAccess = isFreeOrEnrolled || !lesson.isLocked;
                const icon = lesson.isCompleted ? '✅' : !canAccess ? '🔒' : lesson.type === 'video' ? '▶️' : lesson.type === 'quiz' ? '📝' : '📄';
                const typeLabel = lesson.type === 'video' ? '🎥 Video' : lesson.type === 'quiz' ? '📝 Exam' : '📄 PDF';
                return `
                                        <div class="accordion-lesson-item ${lesson.isCompleted ? 'completed' : ''} ${!canAccess ? 'locked' : ''}"
                                             onclick="${canAccess ? "navigate('lesson/" + courseId + "/" + lesson.id + "')" : "showToast('This lesson requires active enrollment. Complete payment or enter code above.', 'error')"}">
                                            <div class="accordion-lesson-left">
                                                <span class="accordion-lesson-num">${pi + 1}.${li + 1}</span>
                                                <div class="accordion-lesson-icon">${icon}</div>
                                                <div style="min-width:0;flex:1;">
                                                    <div class="accordion-lesson-title">${lesson.title}</div>
                                                    <div class="accordion-lesson-meta">
                                                        <span>${typeLabel}</span>
                                                        ${lesson.duration ? `<span>•</span><span>⏱ ${lesson.duration}</span>` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="accordion-lesson-right">
                                                ${lesson.isCompleted
                        ? '<span class="badge badge-success" style="font-size:0.75rem;">✓ Completed</span>'
                        : canAccess
                            ? '<span class="badge" style="font-size:0.75rem;background:rgba(37,99,235,0.1);color:#2563eb;border:1px solid rgba(37,99,235,0.2);">Available</span>'
                            : '<span class="badge" style="font-size:0.75rem;background:rgba(100,116,139,0.1);color:#64748b;border:1px solid rgba(100,116,139,0.2);">🔒 Locked</span>'}
                                            </div>
                                        </div>`;
            }).join('')}
                                </div>
                            </div>`;
        }).join('')}
                    </div>
                </div>
            </div>
        </div>

        <style>
        /* ═══════════════════════════════════════════════════════════
           بطاقة التفعيل المزدوجة الجديدة
           ═══════════════════════════════════════════════════════════ */
        .iq-prem-act-card {
            background: var(--bg-surface);
            border: 1.5px solid var(--border);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.07);
            margin-bottom: var(--space-2xl);
        }
        .iq-prem-act-header {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            background: linear-gradient(135deg, var(--primary-500, #06B6D4) 0%, var(--primary-700, #0E7490) 100%);
            padding: 22px 28px;
            color: #fff;
        }
        .iq-prem-act-lock {
            font-size: 2.4rem;
            flex-shrink: 0;
            animation: lockPulse 2s ease-in-out infinite;
        }
        @keyframes lockPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        .iq-prem-act-header-text h3 {
            font-size: 1.1rem;
            font-weight: 900;
            margin: 0 0 6px;
            color: #fff;
            line-height: 1.4;
        }
        .iq-prem-act-header-text p {
            font-size: 0.9rem;
            margin: 0;
            opacity: 0.9;
        }
        .iq-prem-act-header-text strong {
            background: rgba(255,255,255,0.2);
            padding: 2px 8px;
            border-radius: 6px;
        }
        .iq-prem-act-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
        }
        @media (max-width: 700px) {
            .iq-prem-act-grid { grid-template-columns: 1fr; }
            .iq-prem-act-header { flex-direction: column; gap: 10px; padding: 18px 20px; }
        }
        .iq-prem-act-col {
            padding: 0;
            border-left: 1px solid var(--border);
        }
        .iq-prem-act-col:last-child { border-left: none; }
        .iq-prem-act-col-inner {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 24px;
            gap: 16px;
        }
        .iq-prem-act-col--highlight {
            background: linear-gradient(160deg, rgba(6, 182, 212,0.05) 0%, rgba(8, 145, 178,0.02) 100%);
            border-left: 1px solid rgba(6, 182, 212,0.2);
        }
        .iq-prem-opt-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 4px;
        }
        .iq-prem-opt-icon { font-size: 1.5rem; flex-shrink: 0; }
        .iq-prem-opt-header h4 {
            margin: 0;
            font-size: 1rem;
            font-weight: 900;
            color: var(--text-primary);
            line-height: 1.3;
        }
        .iq-prem-act-col--highlight .iq-prem-opt-header h4 {
            color: #059669;
        }
        .iq-prem-opt-desc {
            font-size: 0.87rem;
            color: var(--text-secondary);
            line-height: 1.7;
            margin: 0;
        }
        .iq-prem-code-form {
            display: flex;
            gap: 10px;
            margin-top: auto;
        }
        @media (max-width: 480px) {
            .iq-prem-code-form { flex-direction: column; }
        }
        .iq-prem-code-input {
            flex: 1;
            background: var(--bg-alt);
            border: 1.5px solid var(--border);
            border-radius: 12px;
            padding: 11px 14px;
            font-size: 1rem;
            font-family: monospace;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--text-primary);
            text-align: center;
            transition: border-color 0.2s;
            outline: none;
        }
        .iq-prem-code-input:focus {
            border-color: var(--primary-500, #06B6D4);
            box-shadow: 0 0 0 3px rgba(6, 182, 212,0.12);
        }
        .iq-prem-code-btn {
            background: linear-gradient(135deg, var(--primary-500, #06B6D4), var(--primary-600, #0891B2));
            color: #fff;
            border: none;
            border-radius: 12px;
            padding: 11px 20px;
            font-size: 0.9rem;
            font-weight: 900;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .iq-prem-code-btn:hover {
            background: #0E7490;
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(6, 182, 212,0.35);
        }
        .iq-prem-code-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .iq-prem-transfer-steps {
            background: var(--bg-alt);
            border-radius: 14px;
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            font-size: 0.88rem;
            color: var(--text-secondary);
            line-height: 1.65;
        }
        .iq-prem-step-row {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        .iq-prem-step-num {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: linear-gradient(135deg, #059669, #10b981);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 0.85rem;
            flex-shrink: 0;
        }
        .iq-prem-vf-num {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(220,38,38,0.1);
            border: 1.5px solid rgba(220,38,38,0.3);
            border-radius: 8px;
            padding: 4px 10px;
            font-family: monospace;
            font-weight: 900;
            font-size: 1rem;
            color: #b91c1c;
            cursor: pointer;
            transition: background 0.2s;
            direction: ltr;
            letter-spacing: 0.5px;
        }
        [data-theme="dark"] .iq-prem-vf-num {
            background: rgba(220,38,38,0.15);
            border-color: rgba(220,38,38,0.4);
            color: #fca5a5;
        }
        .iq-prem-vf-num:hover { background: rgba(220,38,38,0.2); }
        .iq-prem-vf-num small { font-size: 0.75rem; opacity: 0.7; }
        .iq-prem-wa-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            background: linear-gradient(135deg, #25d366, #128c7e);
            color: #fff;
            border: none;
            border-radius: 14px;
            padding: 14px 20px;
            font-size: 0.95rem;
            font-weight: 900;
            cursor: pointer;
            transition: all 0.25s;
            box-shadow: 0 6px 20px rgba(37,211,102,0.3);
            width: 100%;
            margin-top: auto;
        }
        .iq-prem-wa-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 30px rgba(37,211,102,0.45);
        }

        /* ── Keep old CSS classes for backward compat ────────────────── */
        .iq-paywall-card {
            background: linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0b1329 100%);
            border: 2px solid rgba(59, 130, 246, 0.4);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 16px 48px rgba(15, 23, 42, 0.35), 0 0 24px rgba(37, 99, 235, 0.15);
            color: #f8fafc;
            position: relative;
        }
        [data-theme="light"] .iq-paywall-card {
            background: linear-gradient(145deg, #0f172a 0%, #1e3a8a 60%, #172554 100%);
            border-color: rgba(96, 165, 250, 0.5);
            color: #ffffff;
        }

        .iq-shimmer-ribbon {
            background: linear-gradient(90deg, #1e40af 0%, #3b82f6 25%, #60a5fa 50%, #3b82f6 75%, #1e40af 100%);
            background-size: 300% 100%;
            animation: iqRibbonShimmer 3.5s ease infinite;
            padding: 10px 20px;
            text-align: center;
            font-weight: 900;
            font-size: 0.95rem;
            letter-spacing: 1px;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
        @keyframes iqRibbonShimmer {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        .iq-paywall-body {
            padding: 36px 32px 40px;
            text-align: center;
        }

        .iq-badge-wrapper {
            display: flex;
            justify-content: center;
            margin-bottom: 16px;
        }
        .iq-premium-badge {
            background: linear-gradient(135deg, #06B6D4, #10B981, #059669);
            color: #ffffff;
            font-size: 1.15rem;
            font-weight: 900;
            padding: 7px 24px;
            border-radius: 50px;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.45);
            animation: iqBadgePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        @keyframes iqBadgePop {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }

        .iq-paywall-title {
            font-size: 1.6rem;
            font-weight: 900;
            margin-bottom: 10px;
            color: #ffffff;
            line-height: 1.4;
        }
        .iq-paywall-subtitle {
            font-size: 0.95rem;
            color: rgba(226, 232, 240, 0.85);
            max-width: 680px;
            margin: 0 auto 24px;
            line-height: 1.7;
        }

        .iq-price-box {
            display: inline-flex;
            align-items: baseline;
            gap: 8px;
            background: rgba(30, 64, 175, 0.3);
            border: 1.5px solid rgba(96, 165, 250, 0.4);
            border-radius: 16px;
            padding: 12px 28px;
            margin-bottom: 30px;
            backdrop-filter: blur(8px);
        }
        .iq-price-label {
            font-size: 0.9rem;
            color: rgba(226, 232, 240, 0.8);
            font-weight: 600;
        }
        .iq-price-val {
            font-size: 2.2rem;
            font-weight: 900;
            color: #60a5fa;
            line-height: 1;
        }
        .iq-price-curr {
            font-size: 1rem;
            font-weight: 800;
            color: #93c5fd;
        }

        .iq-steps-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
            text-align: right;
        }
        @media(max-width:768px) {
            .iq-steps-grid { grid-template-columns: 1fr; }
            .iq-paywall-body { padding: 24px 16px; }
        }

        .iq-step-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            gap: 16px;
            align-items: flex-start;
            transition: all 0.25s;
        }
        .iq-step-card:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(96, 165, 250, 0.4);
        }
        .iq-step-num {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: linear-gradient(135deg, #06B6D4, #0E7490);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 1.1rem;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }
        .iq-step-info { flex: 1; min-width: 0; }
        .iq-step-title {
            font-size: 1rem;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 6px;
        }
        .iq-step-desc {
            font-size: 0.85rem;
            color: rgba(226, 232, 240, 0.8);
            margin-bottom: 12px;
            line-height: 1.5;
        }

        .iq-vodafone-box {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: rgba(239, 68, 68, 0.15);
            border: 1.5px solid rgba(239, 68, 68, 0.5);
            border-radius: 12px;
            padding: 10px 16px;
            cursor: pointer;
            transition: all 0.2s;
            user-select: all;
        }
        .iq-vodafone-box:hover {
            background: rgba(239, 68, 68, 0.25);
            transform: translateY(-2px);
        }
        .iq-vf-icon { font-size: 1.2rem; }
        .iq-vf-num {
            font-family: monospace;
            font-size: 1.2rem;
            font-weight: 900;
            color: #fca5a5;
            direction: ltr;
            letter-spacing: 1px;
        }
        .iq-vf-copy {
            font-size: 0.75rem;
            color: rgba(254, 202, 202, 0.8);
            font-weight: 700;
        }

        .iq-tg-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: #ffffff;
            text-decoration: none;
            border-radius: 14px;
            padding: 12px 18px;
            transition: all 0.25s;
            box-shadow: 0 4px 16px rgba(2, 132, 199, 0.35);
        }
        .iq-tg-btn:hover {
            transform: translateY(-2px);
            background: linear-gradient(135deg, #0ea5e9, #0284c7);
            box-shadow: 0 8px 24px rgba(2, 132, 199, 0.5);
        }
        .iq-tg-icon { font-size: 1.5rem; flex-shrink: 0; }
        .iq-tg-text { flex: 1; text-align: right; }
        .iq-tg-text strong { display: block; font-size: 0.95rem; }
        .iq-tg-text small { display: block; font-size: 0.75rem; opacity: 0.85; }
        .iq-tg-arrow { font-size: 1.2rem; flex-shrink: 0; }

        .iq-notice-box {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 14px;
            padding: 16px 20px;
            margin-bottom: 24px;
            text-align: right;
            font-size: 0.88rem;
            color: rgba(226, 232, 240, 0.9);
        }
        .iq-notice-title {
            font-weight: 800;
            color: #6ee7b7;
            margin-bottom: 8px;
        }
        .iq-notice-box ul { list-style: none; padding: 0; margin: 0; }
        .iq-notice-box li { margin-bottom: 6px; }

        .iq-code-section {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 16px;
            padding: 20px;
            margin-top: 10px;
        }
        .iq-code-divider {
            text-align: center;
            font-size: 0.9rem;
            color: rgba(226, 232, 240, 0.7);
            margin-bottom: 14px;
            font-weight: 700;
        }
        .iq-code-form {
            display: flex;
            gap: 12px;
            max-width: 500px;
            margin: 0 auto;
        }
        @media(max-width:480px) {
            .iq-code-form { flex-direction: column; }
        }
        .iq-code-form .code-input {
            text-align: center;
            font-family: monospace;
            font-size: 1.1rem;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        .iq-enrolled-banner {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.05));
            border: 2px solid rgba(16, 185, 129, 0.4);
            border-radius: 20px;
            padding: 32px;
            text-align: center;
        }
        </style>`;
    }

    // ═══════════════════════════════════════════════════════════
    // LESSON PAGE
    // ═══════════════════════════════════════════════════════════
    // LESSON PAGE — Index Lessons with Video Tabs & Segments
    // ═══════════════════════════════════════════════════════════
    function renderLessonPage(courseId, lessonId) {
        // غير مسجل → توجيه لصفحة تسجيل الدخول مع حفظ الوجهة
        if (!isLoggedIn) {
            sessionStorage.setItem('iraqiplatform_redirect', 'lesson/' + courseId + '/' + lessonId);
            return renderAuthRequiredPage(courseId);
        }

        const course = getAllCourses().find(c => String(c.id) === String(courseId));
        if (!course) return render404Page();

        // التحقق من تفعيل الكورس
        const isEnrolled = (currentUser.enrolledCourses || []).some(
            id => String(id) === String(courseId)
        );
        const hasAccess = course.isFree || isEnrolled;
        if (!hasAccess) {
            // مسجل لكن غير مفعَّل → صفحة التراخيص (المحتوى مقفول)
            return renderLicensePage(courseId);
        }

        const effectivePackages = sanitizeEffectivePackages(getEffectiveCoursePackages(course, isEnrolled));
        // Enrich lessons with real progress data (isCompleted / isLocked)
        const _rawLessons = effectivePackages.flatMap(p => p.lessons);
        const allLessons = (typeof window.enrichLessonsWithProgress === 'function')
            ? window.enrichLessonsWithProgress(currentUser ? currentUser.id : null, courseId, _rawLessons)
            : _rawLessons;
        // Write enriched lessons back into packages so sidebar + curriculum reflect reality
        let _lIdx = 0;
        effectivePackages.forEach(pkg => { pkg.lessons = pkg.lessons.map(() => allLessons[_lIdx++] || {}); });

        // بحث مرن عن الدرس لتفادي أي عدم تطابق في المعرفات
        const targetLId = String(lessonId || '');
        const lesson = allLessons.find(l =>
            String(l.id) === targetLId ||
            String(l.lessonId) === targetLId ||
            l.id === 'vid_' + targetLId ||
            'vid_' + l.id === targetLId ||
            String(l.id).includes(targetLId)
        ) || allLessons[0];

        if (!lesson) {
            return `
            <div style="padding:calc(var(--header-height) + var(--space-4xl)) 0; text-align:center;">
                <div class="container">
                    <div class="card" style="max-width:500px;margin:0 auto;padding:40px 20px;">
                        <div style="font-size:3.5rem;margin-bottom:12px;">📂</div>
                        <h3>No lectures in this course yet</h3>
                        <p style="color:var(--text-secondary);margin-bottom:20px;">The instructor hasn't added lessons to this course yet.</p>
                        <a href="#license/${courseId}" class="btn btn-primary">&larr; Back to Course</a>
                    </div>
                </div>
            </div>`;
        }

        const lessonIndex = allLessons.indexOf(lesson);
        const prevLesson = lessonIndex > 0 ? allLessons[lessonIndex - 1] : null;
        const nextLesson = lessonIndex < allLessons.length - 1 ? allLessons[lessonIndex + 1] : null;
        const completedCount = allLessons.filter(l => l.isCompleted).length;
        const progressPct = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;

        const hasPdf = Boolean(lesson.pdfUrl && lesson.pdfUrl.trim() !== '');
        const hasQuiz = Boolean(lesson.quizId != null && lesson.quizId !== '');
        const segments = sanitizeLessonSegments(lesson.segments);

        // استرجاع ملاحظات الطالب المحفوظة للدرس
        const noteKey = 'iraqi_note_' + courseId + '_' + (lesson.id || lesson.lessonId);
        const savedNote = localStorage.getItem(noteKey) || '';

        return `
        <div class="lesson-sidebar-backdrop" id="lessonSidebarBackdrop" onclick="toggleLessonSidebar(false)"></div>
        <div class="lesson-page">
            <!-- Sidebar -->
            <div class="lesson-sidebar" id="lessonSidebar">
                <div class="lesson-sidebar-header">
                    <div class="lsh-top">
                        <button class="lsh-back-btn" onclick="navigate('courses')" title="Back to Courses">&larr;</button>
                        <div class="lsh-title">${course.title}</div>
                        <button class="lsh-close-btn" onclick="toggleLessonSidebar(false)" title="Close menu">✕</button>
                    </div>
                    <div class="lesson-sidebar-progress">
                        <div class="lsp-bar">
                            <div class="lsp-fill" style="width:${progressPct}%;"></div>
                        </div>
                        <span class="lsp-pct">${progressPct}%</span>
                    </div>
                    <div class="lsh-stats">
                        <span>📚 ${allLessons.length} Topics</span>
                        <span>•</span>
                        <span>✅ ${completedCount} Completed</span>
                    </div>
                </div>

                <div class="lesson-sidebar-list">
                    ${effectivePackages.map((pkg, pi) => `
                        <div class="acc-pkg open" id="acc-pkg-${pi}">
                            <div class="acc-pkg-header" onclick="this.parentElement.classList.toggle('open')">
                                <span class="acc-pkg-icon">📦</span>
                                <span class="acc-pkg-title">${pkg.title}</span>
                                <span class="acc-pkg-meta">${pkg.lessons.length}</span>
                                <span class="acc-pkg-chevron">▾</span>
                            </div>
                            <div class="acc-pkg-body" style="display:block;">
                                ${pkg.lessons.map((l, li) => {
            const isActive = l.id === lesson.id || l.lessonId === lesson.lessonId;
            const lessonRow = `
                                    <div class="sidebar-lesson-item ${isActive ? 'active' : ''} ${l.isCompleted ? 'completed' : ''} ${l.isLocked ? 'locked' : ''}"
                                         onclick="${l.isLocked ? "showToast('This content is locked', 'error')" : "navigate('lesson/" + courseId + "/" + l.id + "'); if(window.innerWidth<=768) toggleLessonSidebar(false);"}">
                                        <span class="sl-num">${li + 1}</span>
                                        <span class="sl-icon">${l.isCompleted ? '✅' : l.isLocked ? '🔒' : l.type === 'video' ? '▶️' : l.type === 'quiz' ? '📝' : '📄'}</span>
                                        <span class="sl-title">${l.title}</span>
                                        <span class="sl-duration">${l.duration || ''}</span>
                                    </div>`;
            return lessonRow + renderSidebarQuizRow(l, courseId);
        }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Main Lesson Content -->
            <div class="lesson-content">
                <div class="lesson-content-header">
                    <div class="breadcrumb">
                        <a href="#courses">Courses</a>
                        <span class="bc-sep">/</span>
                        <a href="#license/${courseId}">${course.title}</a>
                        <span class="bc-sep">/</span>
                        <span style="color:var(--text-primary);font-weight:700;">${lesson.title}</span>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-top:8px;">
                        <div>
                            <h1 class="lesson-title" style="margin:0 0 8px;">${lesson.title}</h1>
                            <div class="lesson-meta-row">
                                <span class="badge badge-primary">🎥 Video Lecture</span>
                                ${lesson.duration ? `<span class="lesson-duration">⏱️ ${lesson.duration}</span>` : ''}
                                ${hasPdf ? `<span class="badge badge-danger" style="cursor:pointer;" onclick="switchLessonTab('pdf')">📄 PDF Notes</span>` : ''}
                                ${hasQuiz ? `<span class="badge badge-accent" style="cursor:pointer;" onclick="switchLessonTab('quiz')">📝 Quiz Available</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ═══════════ LESSON TABS BAR ═══════════ -->
                <div class="lesson-tabs-nav" id="lessonTabsNav">
                    <button class="lesson-tab-btn active" id="ltab-btn-video" onclick="switchLessonTab('video')">
                        <span class="lt-icon">🎥</span> Video Lecture
                    </button>
                    ${hasPdf ? `
                    <button class="lesson-tab-btn" id="ltab-btn-pdf" onclick="switchLessonTab('pdf')">
                        <span class="lt-icon">📄</span> Notes &amp; PDF
                    </button>` : ''}
                    ${hasQuiz ? `
                    <button class="lesson-tab-btn" id="ltab-btn-quiz" onclick="switchLessonTab('quiz')">
                        <span class="lt-icon">📝</span> Quiz &amp; Practice
                    </button>` : ''}
                    <button class="lesson-tab-btn" id="ltab-btn-overview" onclick="switchLessonTab('overview')">
                        <span class="lt-icon">ℹ️</span> Overview &amp; Notes
                    </button>
                </div>

                <!-- ═══════════ TAB PANES ═══════════ -->
                <!-- Tab 1: Video Player -->
                <div class="lesson-tab-pane active" id="ltab-pane-video">
                    ${renderLessonVideoBlock(lesson)}
                </div>

                <!-- Tab 2: PDF Viewer -->
                <div class="lesson-tab-pane" id="ltab-pane-pdf" style="display:none;">
                    ${renderLessonPdfBlock(lesson)}
                </div>

                <!-- Tab 3: Quiz -->
                <div class="lesson-tab-pane" id="ltab-pane-quiz" style="display:none;">
                    ${renderQuizContent(lesson, courseId)}
                </div>

                <!-- Tab 4: Overview & Notes -->
                <div class="lesson-tab-pane" id="ltab-pane-overview" style="display:none;">
                    <div class="card card-flat" style="padding:24px;border-radius:18px;border:1px solid var(--border);background:var(--bg-surface);margin-bottom:20px;">
                        <h3 style="font-size:1.1rem;font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                            <span>📖</span> Lesson Details &amp; Summary
                        </h3>
                        <p style="color:var(--text-secondary);line-height:1.85;margin-bottom:20px;">
                            ${lesson.description || course.description || 'Comprehensive explanation and practical exercises with Mr. Islam Abdelwahed.'}
                        </p>

                        <div style="border-top:1px dashed var(--border);padding-top:18px;">
                            <h4 style="font-size:0.95rem;font-weight:800;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
                                <span>✏️</span> Your Notes for this lesson (Auto-saved):
                            </h4>
                            <textarea id="lessonStudentNote"
                                      placeholder="Write your notes, formulas, and key points here while watching..."
                                      style="width:100%;min-height:110px;padding:12px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-alt);font-family:inherit;font-size:0.9rem;line-height:1.7;resize:vertical;"
                                      oninput="saveLessonNote('${courseId}', '${lesson.id || lesson.lessonId}')">${savedNote}</textarea>
                            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;display:flex;justify-content:space-between;">
                                <span>🔒 Your notes are private and saved on your device</span>
                                <span id="noteSavedStatus" style="color:var(--success);display:none;">Saved ✓</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ═══════════ LESSON NAVIGATION ═══════════ -->
                <div class="lesson-nav" style="margin-top:var(--space-xl);margin-bottom:var(--space-xl);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                    ${prevLesson ? `
                        <button class="btn btn-outline btn-lg" onclick="navigate('lesson/${courseId}/${prevLesson.id}')">
                            &larr; Previous Lesson
                        </button>
                    ` : '<div></div>'}
                    ${nextLesson ? (() => {
                        const gate = getLessonQuizGateInfo(lesson, courseId);
                        if (gate && gate.locked) {
                            return renderLockedNavButton('&#128274; Next Lesson', gate);
                        }
                        var _navNext = "navigate('lesson/" + courseId + "/" + nextLesson.id + "')";
                        return '<button class="btn btn-primary btn-lg" onclick="' + _navNext + '">Next Lesson &rarr;</button>';
                    })() : (() => {
                        // نفس بوابة الاختبار تتطبق على آخر درس قبل اعتبار الكورس مكتمل
                        const gate = getLessonQuizGateInfo(lesson, courseId);
                        if (gate && gate.locked) {
                            return renderLockedNavButton('&#128274; Course Completed', gate);
                        }
                        return '<button class="btn btn-accent btn-lg" onclick="navigate(\'license/' + courseId + '\')">' +
                               '&#127881; Congratulations! Course Completed</button>';
                    })()}
                </div>

                <!-- ═══════════ IN-PAGE PACKAGES & LESSONS LIST ═══════════ -->
                <div class="lesson-page-curriculum" style="margin-top:var(--space-2xl);background:var(--bg-surface);padding:24px 20px;border-radius:20px;border:1px solid var(--border);box-shadow:0 4px 20px rgba(0,0,0,0.04);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap;">
                        <div>
                            <h2 style="margin:0 0 4px;font-size:1.2rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                                <span>📋</span> All Course Lectures &amp; Topics (${effectivePackages.length} Units · ${allLessons.length} Topics)
                            </h2>
                            <p style="margin:0;font-size:0.85rem;color:var(--text-muted);">Click on any lesson to navigate directly:</p>
                        </div>
                        <span class="badge badge-primary" style="font-size:0.8rem;padding:6px 14px;font-weight:800;border-radius:10px;">
                            ${completedCount} / ${allLessons.length} Completed
                        </span>
                    </div>

                    <div class="license-accordion" id="lessonInpageAccordion">
                        ${effectivePackages.map((pkg, pi) => {
            const pkgLessons = pkg.lessons;
            const completedInPkg = pkgLessons.filter(l => l.isCompleted).length;
            const hasActiveLesson = pkgLessons.some(l => (l.id === lesson.id || l.lessonId === lesson.lessonId));
            return `
                            <div class="accordion-package ${hasActiveLesson || pi === 0 ? 'open' : ''}" id="inpage-pkg-${pi}">
                                <div class="accordion-pkg-header" onclick="toggleInpageAccordion(${pi})">
                                    <div class="accordion-pkg-title">
                                        <span class="pkg-badge">${pi + 1}</span>
                                        <span>📦 ${pkg.title}</span>
                                    </div>
                                    <div class="accordion-pkg-meta">
                                        <span>${completedInPkg}/${pkgLessons.length} Completed</span>
                                        <span class="lesson-count">${pkgLessons.length} Topics</span>
                                        <span class="accordion-pkg-arrow" id="inpage-arrow-${pi}">▼</span>
                                    </div>
                                </div>
                                <div class="accordion-pkg-lessons ${hasActiveLesson || pi === 0 ? 'open' : ''}" id="inpage-lessons-${pi}">
                                    ${pkgLessons.map((l, li) => {
                const isActive = l.id === lesson.id || l.lessonId === lesson.lessonId;
                const icon = l.isCompleted ? '✅' : l.isLocked ? '🔒' : l.type === 'video' ? '▶️' : l.type === 'quiz' ? '📝' : '📄';
                const typeLabel = l.type === 'video' ? '🎥 Video' : l.type === 'quiz' ? '📝 Quiz' : '📄 PDF Note';
                const lessonRow = `
                                        <div class="accordion-lesson-item ${isActive ? 'active-lesson-item' : ''} ${l.isCompleted ? 'completed' : ''} ${l.isLocked ? 'locked' : ''}"
                                             style="${isActive ? 'background:rgba(37,99,235,0.08);border-left:3px solid var(--primary,#2563eb);' : ''}"
                                             onclick="${l.isLocked ? "showToast('This content is locked', 'error')" : "navigate('lesson/" + courseId + "/" + l.id + "')"}">
                                            <div class="accordion-lesson-left" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                                                <span class="accordion-lesson-num" style="font-weight:800;font-size:0.8rem;color:var(--text-muted);min-width:24px;">${pi + 1}.${li + 1}</span>
                                                <div class="accordion-lesson-icon" style="font-size:1.1rem;flex-shrink:0;">${icon}</div>
                                                <div style="min-width:0;flex:1;">
                                                    <div class="accordion-lesson-title" style="font-weight:700;font-size:0.95rem;color:${isActive ? 'var(--primary,#2563eb)' : 'var(--text-primary)'};">
                                                        ${l.title} ${isActive ? '<span class="badge badge-primary" style="font-size:0.7rem;margin-left:6px;padding:2px 8px;">Playing Now ◀</span>' : ''}
                                                    </div>
                                                    <div class="accordion-lesson-meta" style="font-size:0.78rem;color:var(--text-muted);display:flex;gap:6px;align-items:center;margin-top:2px;">
                                                        <span>${typeLabel}</span>
                                                        ${l.duration ? `<span>•</span><span>⏱ ${l.duration}</span>` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="accordion-lesson-right" style="flex-shrink:0;margin-left:8px;">
                                                ${isActive
                        ? '<span class="badge badge-primary" style="font-size:0.75rem;">Playing</span>'
                        : l.isCompleted
                            ? '<span class="badge badge-success" style="font-size:0.75rem;">✓ Completed</span>'
                            : !l.isLocked
                                ? '<span class="badge" style="font-size:0.75rem;background:rgba(37,99,235,0.1);color:#2563eb;border:1px solid rgba(37,99,235,0.2);">Available</span>'
                                : '<span class="badge" style="font-size:0.75rem;background:rgba(100,116,139,0.1);color:#64748b;border:1px solid rgba(100,116,139,0.2);">🔒 Locked</span>'}
                                            </div>
                                        </div>`;
                const quizRow = renderCurriculumQuizRow(l, courseId);
                return lessonRow + quizRow;
            }).join('')}
                                </div>
                            </div>`;
        }).join('')}
                    </div>
                </div>
            </div>
        </div>

        <button class="lesson-sidebar-toggle" onclick="toggleLessonSidebar()" aria-label="Lessons Menu">
            <span style="font-size:1.15rem;">📚</span>
            <span>Lessons (${allLessons.length})</span>
        </button>`;
        // ── التبديل السلس بين تبويبات الدرس ─────────────────────────
        window.switchLessonTab = function (tabId) {
            document.querySelectorAll('.lesson-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.lesson-tab-pane').forEach(p => {
                p.style.display = 'none';
                p.classList.remove('active');
            });

            const activeBtn = document.getElementById('ltab-btn-' + tabId);
            const activePane = document.getElementById('ltab-pane-' + tabId);
            if (activeBtn) activeBtn.classList.add('active');
            if (activePane) {
                activePane.style.display = 'block';
                activePane.classList.add('active');
            }
        };

        // ── حفظ ملاحظات الطالب للدرس ────────────────────────────────
        window.saveLessonNote = function (courseId, lessonId) {
            const textarea = document.getElementById('lessonStudentNote');
            const status = document.getElementById('noteSavedStatus');
            if (!textarea) return;
            const key = 'iraqi_note_' + courseId + '_' + lessonId;
            localStorage.setItem(key, textarea.value);
            if (status) {
                status.style.display = 'inline';
                clearTimeout(window._noteTimer);
                window._noteTimer = setTimeout(() => { status.style.display = 'none'; }, 2000);
            }
        };

        // ── تشغيل مقطع فيديو محدد داخل الدرس (Multi-Segment Video) ───
        window.playLessonSegment = function (videoUrl, title, btnEl) {
            if (!videoUrl) return;
            var iframeContainer = document.getElementById('lessonVideoEmbedContainer');
            if (iframeContainer) {
                var isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(videoUrl);
                var embedSrc = toSafeEmbedUrl(videoUrl);
                if (isDirectVideo) {
                    iframeContainer.innerHTML = [
                        '<video controls style="position:absolute;top:0;left:0;width:100%;height:100%;background:#000;" preload="metadata">',
                        '<source src="' + videoUrl + '">Your browser does not support HTML5 video.</video>'
                    ].join('');
                } else {
                    // Load directly (segment switch = user intent to play)
                    var playUrl = embedSrc + (embedSrc.indexOf('?') > -1 ? '&' : '?') + 'autoplay=1';
                    iframeContainer.innerHTML = [
                        '<iframe src="' + playUrl + '" frameborder="0" allowfullscreen',
                        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"',
                        ' referrerpolicy="strict-origin-when-cross-origin"',
                        ' style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;border-radius:14px;z-index:1;"></iframe>',
                        '<div class="yt-shield yt-shield-top" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
                        '<div class="yt-shield yt-shield-tr" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
                        '<div class="yt-shield yt-shield-tl" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
                        '<div class="yt-shield yt-shield-br" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
                        '<div class="yt-shield yt-shield-bl" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>'
                    ].join('');
                }
            }
            document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            if (btnEl) btnEl.classList.add('active');
            showToast('Now Playing: ' + (title || 'Segment'), 'info');
        };

        // ── تحويل الرابط إلى Embed آمن يدعم كل صيغ الفيديو ─────────
        function toSafeEmbedUrl(u) {
            if (!u) return '';
            u = String(u).trim();
            // Bunny / mediadelivery
            if (u.includes('iframe.mediadelivery.net') || u.includes('video.bunnycdn.com')) {
                return u;
            }
            // YouTube Embed ID Parser
            let ytId = null;
            try {
                const parsed = new URL(u);
                if (parsed.hostname === 'youtu.be') {
                    ytId = parsed.pathname.replace(/^\//, '').split('?')[0];
                } else if (parsed.hostname.includes('youtube.com')) {
                    ytId = parsed.searchParams.get('v') || parsed.pathname.replace(/^\/(embed|shorts|live)\//, '').split('/')[0];
                }
            } catch (e) {
                const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
                if (m) ytId = m[1];
            }
            if (ytId && /^[A-Za-z0-9_-]{11}$/.test(ytId)) {
                return 'https://www.youtube.com/embed/' + ytId + '?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=1&enablejsapi=1';
            }
            if (u.includes('youtube.com/embed/')) return u;
            // Vimeo
            const vm = u.match(/vimeo\.com\/(\d+)/);
            if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
            return u;
        }

        // ── تشغيل فيديو الدرس (YouTube, Vimeo, Bunny, MP4) ──────────
        function renderLessonVideoBlock(lesson) {
            var segments = sanitizeLessonSegments(lesson.segments);
            var url = lesson.videoUrl || lesson.content || lesson.url || lesson.video || '';

            if (!url && segments.length > 0) {
                var s0 = segments[0];
                url = s0.bunnyVideoId
                    ? ('https://iframe.mediadelivery.net/embed/691851/' + s0.bunnyVideoId + '?autoplay=false')
                    : (s0.videoUrl || '');
            }

            if (!url) {
                for (var key of Object.keys(lesson || {})) {
                    var val = lesson[key];
                    if (typeof val === 'string' && val.length > 10 &&
                        (val.includes('youtube') || val.includes('youtu.be') ||
                            val.includes('vimeo') || val.includes('bunny') ||
                            val.includes('mediadelivery') || /\.(mp4|webm|ogg)/i.test(val))) {
                        url = val;
                        break;
                    }
                }
            }

            if (!url && segments.length === 0) {
                return `
            <div class="video-player-wrap">
                <div class="video-placeholder">
                    <div class="play-btn-big">▶</div>
                    <span style="font-weight:700;font-size:1rem;color:rgba(255,255,255,0.85);">No recorded video available for this lesson yet</span>
                    <span style="font-size:0.85rem;color:rgba(255,255,255,0.5);">You can check the attached PDF notes or online quiz above</span>
                </div>
            </div>`;
            }

            var segmentsHTML = '';
            if (segments.length > 1) {
                segmentsHTML = `
            <div class="segments-playlist" style="margin-bottom:16px;background:var(--bg-surface);padding:14px 18px;border-radius:16px;border:1px solid var(--border);">
                <div style="font-weight:800;font-size:0.9rem;color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                    <span>🎬</span> Lecture Segments (${segments.length} segments):
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${segments.map((seg, si) => {
                    const sUrl = seg.bunnyVideoId
                        ? (`https://iframe.mediadelivery.net/embed/691851/${seg.bunnyVideoId}?autoplay=false`)
                        : (seg.videoUrl || '');
                    const isActive = si === 0;
                    return `
                        <button class="segment-btn ${isActive ? 'active' : ''}"
                                onclick="playLessonSegment('${sUrl}', '${seg.title || ('Segment ' + (si + 1))}', this)">
                            <span>▶ ${seg.title || ('Segment ' + (si + 1))}</span>
                            ${seg.duration ? `<small style="opacity:0.7;">(${seg.duration})</small>` : ''}
                        </button>`;
                }).join('')}
                </div>
            </div>`;
            }

            var embedUrl = toSafeEmbedUrl(url);
            var isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);

            // Extract YouTube Video ID for Thumbnail
            var ytId = null;
            if (!isDirectVideo) {
                var _m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
                if (_m) ytId = _m[1];
            }

            var videoInnerHTML;
            if (isDirectVideo) {
                videoInnerHTML = [
                    '<video controls style="position:absolute;top:0;left:0;width:100%;height:100%;background:#000;" preload="metadata">',
                    '<source src="' + url + '">Your browser does not support HTML5 video.</video>'
                ].join('');
            } else if (ytId) {
                // Thumbnail-first: student clicks to play inside the platform
                var thumbUrl = 'https://img.youtube.com/vi/' + ytId + '/maxresdefault.jpg';
                var hqUrl    = 'https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg';
                videoInnerHTML = [
                    '<div id="yt-thumb-overlay" data-embed="' + encodeURIComponent(embedUrl) + '" style="position:absolute;top:0;left:0;width:100%;height:100%;',
                    'cursor:pointer;z-index:5;background:#000;border-radius:14px;overflow:hidden;"',
                    ' onclick="window.loadLessonIframe(decodeURIComponent(this.dataset.embed), this)">',
                    '<img src="' + thumbUrl + '" onerror="this.src=\'' + hqUrl + '\'"',
                    ' style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.82;" loading="lazy" alt="">',
                    '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">',
                    '<div style="width:76px;height:76px;border-radius:50%;',
                    'background:linear-gradient(135deg,#047857,#059669,#F59E0B);',
                    'box-shadow:0 0 36px rgba(5, 150, 105,0.7);display:flex;align-items:center;justify-content:center;',
                    'font-size:2.2rem;color:#fff;">&#9654;</div>',
                    '<span style="color:#fff;font-size:0.95rem;font-weight:800;text-shadow:0 2px 8px rgba(0,0,0,0.8);',
                    'background:rgba(0,0,0,0.45);padding:4px 18px;border-radius:20px;">اضغط للتشغيل</span>',
                    '</div></div>'
                ].join('');
            } else {
                // Non-YouTube (Vimeo, Bunny, etc.) - load directly with shields
                videoInnerHTML = [
                    '<iframe src="' + embedUrl + '" frameborder="0" allowfullscreen',
                    ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"',
                    ' referrerpolicy="strict-origin-when-cross-origin"',
                    ' style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;border-radius:14px;z-index:1;"></iframe>',
                    '<div class="yt-shield yt-shield-top" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
                    '<div class="yt-shield yt-shield-tr" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
                    '<div class="yt-shield yt-shield-tl" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
                    '<div class="yt-shield yt-shield-br" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>',
                    '<div class="yt-shield yt-shield-bl" onclick="event.stopPropagation();event.preventDefault();return false;" oncontextmenu="return false;"></div>'
                ].join('');
            }

            return (
                '<div>' + segmentsHTML +
                '<div class="video-player-wrap">' +
                '<div class="video-responsive-wrap" id="lessonVideoEmbedContainer">' +
                videoInnerHTML +
                '</div></div></div>'
            );
        }

        // loadLessonIframe defined at module level below

        // ── عرض ملف PDF ──────────────────────────────────────────────
        function renderLessonPdfBlock(lesson) {
            var url = lesson.pdfUrl || lesson.content || '';
            if (!url) {
                return `
            <div class="card card-flat" style="padding:var(--space-2xl);text-align:center;border-radius:18px;border:1px solid var(--border);background:var(--bg-surface);">
                <div style="font-size:3.5rem;margin-bottom:var(--space-sm);">📄</div>
                <h3 style="margin-bottom:var(--space-xs);">${lesson.pdfName || lesson.title || 'PDF File'}</h3>
                <p style="color:var(--text-secondary);">No PDF file available for this lesson currently.</p>
            </div>`;
            }
            return `
        <div class="pdf-viewer-block">
            <div class="pdf-actions">
                <div class="pdf-title">📄 ${lesson.pdfName || lesson.title || 'Lesson Notes &amp; Summary'}</div>
                <div style="display:flex;gap:8px;">
                    <a href="${url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">🔍 Open in New Tab</a>
                    <a href="${url}" download class="btn btn-outline btn-sm">⬇️ Download PDF</a>
                </div>
            </div>
            <iframe src="${url}" title="${lesson.title || 'PDF'}"></iframe>
        </div>`;
        }

        // ── نفس صف الاختبار لكن بشكل مبسّط لقائمة الـ Sidebar الجانبية ──
        function renderSidebarQuizRow(l, courseId) {
            if (!l.quizId) return '';
            var attempt = (typeof window.getQuizAttempt === 'function' && currentUser)
                ? window.getQuizAttempt(currentUser.id, l.quizId) : null;
            var done = !!(attempt && attempt.status === 'submitted');
            var passed = !!(attempt && attempt.passed);
            var locked = !!l.isLocked;
            var icon = done ? (passed ? '✅' : '📊') : locked ? '🔒' : '📝';
            var navAction = locked
                ? "showToast('Complete the lesson first to unlock its quiz', 'error')"
                : "navigate('test/" + l.quizId + "/" + courseId + "/" + (l.id || '') + "'); if(window.innerWidth<=768) toggleLessonSidebar(false);";
            return `
                                    <div class="sidebar-lesson-item ${passed ? 'completed' : ''} ${locked ? 'locked' : ''}"
                                         style="background:rgba(6, 182, 212,0.05);"
                                         onclick="${navAction}">
                                        <span class="sl-num">↳</span>
                                        <span class="sl-icon">${icon}</span>
                                        <span class="sl-title">Quiz${done ? ' — ' + attempt.score + '/' + attempt.total : ''}</span>
                                        <span class="sl-duration"></span>
                                    </div>`;
        }

        // ── صف الاختبار في قائمة "كل دروس الكورس" — يظهر بعد الدرس المرتبط به مباشرة ──
        function renderCurriculumQuizRow(l, courseId) {
            if (!l.quizId) return '';
            var quiz = (typeof window.getQuizById === 'function') ? window.getQuizById(l.quizId) : null;
            var attempt = (typeof window.getQuizAttempt === 'function' && currentUser)
                ? window.getQuizAttempt(currentUser.id, l.quizId) : null;
            var done = !!(attempt && attempt.status === 'submitted');
            var passed = !!(attempt && attempt.passed);
            var locked = !!l.isLocked; // نفس حالة قفل الدرس المرتبط بيه
            var icon = done ? (passed ? '✅' : '📊') : locked ? '🔒' : '📝';
            var title = 'Quiz: ' + (quiz ? quiz.title : l.title);
            var statusBadge = done
                ? '<span class="badge ' + (passed ? 'badge-success' : '') + '" style="font-size:0.75rem;' + (passed ? '' : 'background:rgba(220,38,38,0.1);color:#dc2626;border:1px solid rgba(220,38,38,0.25);') + '">' +
                    (passed ? '✓ Passed' : '✕ Not Passed') + ' — ' + attempt.score + '/' + attempt.total +
                    (attempt.percentage != null ? ' (' + attempt.percentage + '%)' : '') + '</span>'
                : locked
                    ? '<span class="badge" style="font-size:0.75rem;background:rgba(100,116,139,0.1);color:#64748b;border:1px solid rgba(100,116,139,0.2);">🔒 Locked</span>'
                    : '<span class="badge" style="font-size:0.75rem;background:rgba(6, 182, 212,0.12);color:#0e7490;border:1px solid rgba(6, 182, 212,0.25);">📝 Available</span>';
            var navAction = locked
                ? "showToast('Complete the lesson first to unlock its quiz', 'error')"
                : "navigate('test/" + l.quizId + "/" + courseId + "/" + (l.id || '') + "')";
            return `
                                        <div class="accordion-lesson-item ${passed ? 'completed' : ''} ${locked ? 'locked' : ''}"
                                             style="background:rgba(6, 182, 212,0.05);"
                                             onclick="${navAction}">
                                            <div class="accordion-lesson-left" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                                                <span class="accordion-lesson-num" style="font-weight:800;font-size:0.8rem;color:var(--text-muted);min-width:24px;">↳</span>
                                                <div class="accordion-lesson-icon" style="font-size:1.1rem;flex-shrink:0;">${icon}</div>
                                                <div style="min-width:0;flex:1;">
                                                    <div class="accordion-lesson-title" style="font-weight:700;font-size:0.95rem;color:var(--text-primary);">${title}</div>
                                                    <div class="accordion-lesson-meta" style="font-size:0.78rem;color:var(--text-muted);display:flex;gap:6px;align-items:center;margin-top:2px;">
                                                        <span>📝 Quiz</span>
                                                        ${done ? `<span>• ✔ ${attempt.correct != null ? attempt.correct : '—'} / ✘ ${attempt.wrong != null ? attempt.wrong : '—'}</span>` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="accordion-lesson-right" style="flex-shrink:0;margin-left:8px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                                                ${statusBadge}
                                                ${done ? '<span style="font-size:0.72rem;color:var(--primary-600,#0891B2);font-weight:700;">📋 View Result</span>' : ''}
                                            </div>
                                        </div>`;
        }

        // ── فحص بوابة الاختبار لدرس معيّن: هل الطالب اجتاز اختبار هذا الدرس؟ ──
        // يُستخدم لقفل "الدرس التالي" و"إتمام الكورس" على حدٍ سواء
        function getLessonQuizGateInfo(lesson, courseId) {
            const _cQuizId = lesson.quizId;
            if (!_cQuizId) return { locked: false };
            const _cQuiz = (typeof window.getQuizById === 'function') ? window.getQuizById(_cQuizId) : null;
            const _cPass = _cQuiz ? (_cQuiz.averageGrade || _cQuiz.passingGrade || 50) : 50;
            const _cAttempt = (typeof window.getQuizAttempt === 'function' && currentUser)
                ? window.getQuizAttempt(currentUser.id, _cQuizId) : null;
            const _cPct = _cAttempt
                ? (_cAttempt.percentage !== undefined ? _cAttempt.percentage
                    : (_cAttempt.total > 0 ? Math.round(_cAttempt.score / _cAttempt.total * 100) : 0))
                : -1;
            if (!_cAttempt || _cPct < _cPass) {
                return {
                    locked: true,
                    message: !_cAttempt
                        ? 'You must complete this lesson\'s quiz first (pass rate: ' + _cPass + '%)'
                        : 'Score ' + _cPct + '% &mdash; below the ' + _cPass + '% required. Each quiz can only be taken once, so the next step stays locked.',
                    btnLabel: !_cAttempt ? 'Start Quiz' : 'View Result',
                    navQuiz: "navigate('test/" + _cQuizId + "/" + courseId + "/" + (lesson.id || '') + "')"
                };
            }
            return { locked: false };
        }

        function renderLockedNavButton(lockedLabel, gate) {
            return [
                '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">',
                '<button class="btn btn-primary btn-lg" disabled style="opacity:0.45;cursor:not-allowed;">',
                lockedLabel, '</button>',
                '<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:12px;padding:10px 16px;font-size:0.85rem;font-weight:700;color:#065F46;text-align:center;">',
                gate.message,
                '</div>',
                '<button class="btn btn-accent" onclick="' + gate.navQuiz + '">',
                '&#128221; ' + gate.btnLabel + '</button>',
                '</div>'
            ].join('');
        }

        // ── عرض الاختبار داخل الدرس — يقرأ من alsaqr_quizzes ──────────
        function renderQuizContent(lesson, courseId) {
            var quizId = lesson.quizId || lesson.id || null;
            var quiz = (typeof window.getQuizById === 'function') ? window.getQuizById(quizId) : null;

            if (!quiz) {
                return `
            <div class="quiz-section" style="text-align:center;padding:var(--space-2xl);background:var(--bg-surface);border-radius:18px;border:1px solid var(--border);">
                <div style="font-size:3.5rem;margin-bottom:var(--space-sm);">📝</div>
                <h3 style="margin-bottom:var(--space-xs);">${lesson.title || 'Lesson Quiz'}</h3>
                <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);">
                    ${quizId ? 'The quiz is being prepared by the teacher.' : 'No quiz attached to this lesson yet.'}
                </p>
            </div>`;
            }

            var qCount = (quiz.questionsList || quiz.questions || []).length;
            var timeLabel = quiz.time ? quiz.time + ' mins' : '—';
            var prevAttempt = (typeof window.getQuizAttempt === 'function' && currentUser)
                ? window.getQuizAttempt(currentUser.id, quizId) : null;

            return `
        <div class="quiz-preview-card" style="background:var(--bg-surface);padding:32px;border-radius:20px;border:1.5px solid var(--border);box-shadow:0 8px 30px rgba(0,0,0,0.05);text-align:center;">
            <div style="font-size:3.5rem;margin-bottom:12px;">📝</div>
            <h2 style="font-size:1.4rem;font-weight:900;margin-bottom:6px;color:var(--text-primary);">${quiz.title || 'Lesson Quiz'}</h2>
            ${quiz.subject ? `<p style="color:var(--text-secondary);margin-bottom:20px;font-weight:600;">${quiz.subject}</p>` : ''}

            <div style="display:flex;justify-content:center;gap:24px;margin:20px 0;flex-wrap:wrap;">
                <div style="background:var(--bg-alt);padding:12px 20px;border-radius:12px;border:1px solid var(--border);">
                    <div style="font-size:1.3rem;font-weight:900;color:var(--primary-500, #06B6D4);">${qCount}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);font-weight:700;">Questions</div>
                </div>
                <div style="background:var(--bg-alt);padding:12px 20px;border-radius:12px;border:1px solid var(--border);">
                    <div style="font-size:1.3rem;font-weight:900;color:var(--accent);">${timeLabel}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);font-weight:700;">Time Limit</div>
                </div>
                ${prevAttempt ? `
                <div style="background:var(--bg-alt);padding:12px 20px;border-radius:12px;border:1px solid var(--border);">
                    <div style="font-size:1.3rem;font-weight:900;color:${prevAttempt.passed ? 'var(--success)' : '#DC2626'};">${prevAttempt.score} / ${prevAttempt.total}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);font-weight:700;">${prevAttempt.percentage != null ? prevAttempt.percentage + '%' : ''} ${prevAttempt.passed ? '· ✅ Passed' : '· Not Passed'}</div>
                </div>` : ''}
            </div>

            ${prevAttempt ? `
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;font-size:0.82rem;font-weight:700;">
                <span style="background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;border-radius:20px;padding:5px 12px;">✔ Correct: ${prevAttempt.correct != null ? prevAttempt.correct : '—'}</span>
                <span style="background:#FEF2F2;color:#DC2626;border:1px solid #FCA5A5;border-radius:20px;padding:5px 12px;">✘ Wrong: ${prevAttempt.wrong != null ? prevAttempt.wrong : '—'}</span>
            </div>
            <div style="background:${prevAttempt.passed ? '#DCFCE7' : '#FEF2F2'};color:${prevAttempt.passed ? '#15803D' : '#DC2626'};border:1px solid ${prevAttempt.passed ? '#86EFAC' : '#FCA5A5'};border-radius:12px;padding:10px 16px;font-size:0.85rem;font-weight:700;margin:4px 0 16px;">
                🔒 This quiz has already been submitted — each quiz can only be taken once. You can review your answers only.
            </div>` : ''}

            <div style="margin-top:24px;">
                <button class="btn btn-primary btn-lg" onclick="navigate('test/${quizId}/${courseId}/${lesson.id || ''}')" style="padding:14px 36px;font-size:1.05rem;font-weight:900;">
                    ${prevAttempt ? '📋 View Result' : '⚡ Start Quiz Now'}
                </button>
            </div>
        </div>`;
        }

        // ── أنماط صفحة معاينة الاختبار (تُحقن مرة واحدة في <head>) ──────
        (function injectQuizPreviewStyles() {
            if (document.getElementById('quiz-preview-styles')) return;
            var s = document.createElement('style');
            s.id = 'quiz-preview-styles';
            s.textContent = [
                '.quiz-preview-card{background:var(--bg-surface,#fff);border:2px solid var(--primary-200,#bfdbfe);border-radius:24px;padding:40px 32px;text-align:center;max-width:540px;margin:0 auto;box-shadow:0 8px 32px rgba(30,64,175,.08);}',
                '.qp-icon{font-size:3.5rem;margin-bottom:12px;}',
                '.qp-title{font-size:1.4rem;font-weight:900;margin-bottom:6px;color:var(--text-primary,#0f172a);}',
                '.qp-subject{color:var(--text-secondary,#64748b);font-size:.9rem;margin-bottom:20px;}',
                '.qp-stats{display:flex;gap:20px;justify-content:center;background:var(--bg-alt,#f8fafc);border-radius:14px;padding:16px 20px;margin-bottom:24px;}',
                '.qp-stat{display:flex;flex-direction:column;align-items:center;gap:3px;}',
                '.qp-stat-num{font-size:1.3rem;font-weight:900;color:var(--primary-600,#2563eb);}',
                '.qp-stat-lbl{font-size:.78rem;color:var(--text-secondary,#64748b);font-weight:600;}',
                '.qp-prev-result{background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px 16px;margin-bottom:20px;display:flex;align-items:center;gap:8px;justify-content:center;flex-wrap:wrap;font-size:.9rem;}',
                '.qp-actions{margin-bottom:16px;}',
                '.qp-hint{font-size:.82rem;color:var(--text-muted,#94a3b8);}'
            ].join('');
            document.head.appendChild(s);
        })();
    } // end renderQuizContent (was closed by orphaned block in original)

    // ── صفحة "تم اجتياز الاختبار مسبقاً" — عرض النتيجة فقط بدون إعادة حل ──
    function renderAlreadyPassedQuizPage(quiz, attempt, courseId, lessonId, backUrl) {
        var letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        var questions = quiz.questionsList || [];
        var answers = attempt.answers || {};
        var reviewRows = questions.map(function (q, qi) {
            var chosen = answers[qi];
            var isCorrect = (chosen !== undefined && chosen === q.correctOpt);
            var chosenLabel = (chosen !== undefined && q.opts && q.opts[chosen]) ? letters[chosen] + '. ' + q.opts[chosen] : '—';
            var correctLabel = (q.opts && q.opts[q.correctOpt]) ? letters[q.correctOpt] + '. ' + q.opts[q.correctOpt] : '—';
            return '<div style="display:flex;gap:12px;align-items:flex-start;padding:14px 20px;border-bottom:1px solid var(--border);text-align:left;direction:ltr;">' +
                '<div style="font-size:1.15rem;flex-shrink:0;">' + (isCorrect ? '✅' : '❌') + '</div>' +
                '<div style="flex:1;">' +
                    '<div style="font-weight:700;margin-bottom:4px;color:var(--text-primary);">' + (qi + 1) + '. ' + (q.q || '') + '</div>' +
                    '<div style="font-size:0.85rem;color:' + (isCorrect ? '#16a34a' : '#dc2626') + ';">Your answer: ' + chosenLabel + '</div>' +
                    (!isCorrect ? '<div style="font-size:0.85rem;color:#16a34a;">Correct answer: ' + correctLabel + '</div>' : '') +
                '</div></div>';
        }).join('');

        var isPass = !!attempt.passed;
        return `
        <div style="min-height:100vh;padding:calc(var(--header-height, 70px) + 30px) 0 60px;background:var(--bg-alt,#f8fafc);">
            <div class="container" style="max-width:680px;margin:0 auto;padding:0 20px;">
                <div style="background:var(--bg-surface,#fff);border:1.5px solid var(--border);border-radius:20px;padding:36px 28px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,0.05);">
                    <div style="font-size:3rem;margin-bottom:8px;">${isPass ? '✅' : '📝'}</div>
                    <h2 style="font-size:1.3rem;font-weight:900;margin-bottom:6px;color:var(--text-primary);">You Have Already Completed This Quiz</h2>
                    <p style="color:var(--text-secondary);margin-bottom:18px;">${quiz.title || 'Quiz'} — Score: <strong>${attempt.score}/${attempt.total} (${attempt.percentage != null ? attempt.percentage : '—'}%)</strong></p>
                    <div style="background:${isPass ? '#DCFCE7' : '#FEF2F2'};color:${isPass ? '#15803D' : '#DC2626'};border:1px solid ${isPass ? '#86EFAC' : '#FCA5A5'};border-radius:12px;padding:10px 16px;font-size:0.85rem;font-weight:700;margin-bottom:22px;display:inline-block;">
                        ${isPass
                            ? '🔒 Each quiz can only be taken once — review your answers below.'
                            : '🔒 Each quiz can only be taken once, and the required score was not reached — review your answers below.'}
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="navigate('${backUrl}')">&larr; Back to Lesson</button>
                    </div>
                </div>
                <div style="background:var(--bg-surface,#fff);border:1.5px solid var(--border);border-radius:20px;margin-top:20px;overflow:hidden;">
                    <div style="padding:16px 20px;border-bottom:1px solid var(--border);font-weight:800;color:var(--text-primary);">📋 Your Answers (${questions.length} Questions)</div>
                    ${reviewRows}
                </div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // TEST PAGE — صفحة الاختبار الكاملة والاحترافية
    // route: #test/quizId/courseId/lessonId
    // ═══════════════════════════════════════════════════════════
    function renderTestPage(quizId, courseId, lessonId) {
        // ── التحقق من تسجيل الدخول ──────────────────────────────
        if (!isLoggedIn) {
            sessionStorage.setItem('iraqiplatform_redirect', 'test/' + [quizId, courseId, lessonId].filter(Boolean).join('/'));
            navigate('login');
            return '';
        }

        // ── جلب الاختبار من DB ───────────────────────────────────
        var quiz = (typeof window.getQuizById === 'function') ? window.getQuizById(quizId) : null;
        if (!quiz) {
            return `<div style="padding:calc(var(--header-height,70px) + 40px) 0 60px;">
                <div class="container"><div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <h3>Quiz Not Found</h3>
                    <p>The quiz you are looking for (${quizId || '—'}) does not exist.</p>
                    <button class="btn btn-primary" onclick="history.back()">&larr; Back</button>
                </div></div></div>`;
        }

        var questions = quiz.questionsList || [];
        var qCount = questions.length;
        var backUrl = courseId && lessonId ? 'lesson/' + courseId + '/' + lessonId : courseId ? 'license/' + courseId : 'courses';

        // ── نتيجة سابقة (فحص أولي سريع فقط لعرض أفضل عند التحميل — الفحص
        //    الحقيقي والنهائي بيحصل بشكل غير متزامن جوه initTestPage عن
        //    طريق قاعدة البيانات مباشرة، وهو اللي بيحدد فعليًا لو الطالب
        //    يقدر يحل الاختبار ولا لأ. الفحص هنا لا يمنع أي حاجة نهائيًا) ──
        var prevAttempt = (typeof window.getQuizAttempt === 'function' && currentUser)
            ? window.getQuizAttempt(currentUser.id, quizId) : null;

        return `
        <div class="test-page" id="testPageRoot">

            <!-- ── Header ── -->
            <div class="test-header">
                <button class="test-back-btn" onclick="navigate('${backUrl}')" title="Back">&larr;</button>
                <div class="test-header-info">
                    <div class="test-title">${quiz.title || 'Quiz'}</div>
                    ${quiz.subject ? `<div class="test-subject">${quiz.subject}</div>` : ''}
                </div>
                <div class="test-header-meta">
                    <span id="testTimerBadge" class="test-timer-badge" style="display:${quiz.time ? '' : 'none'};">
                        ⏱️ <span id="testTimerDisplay">${quiz.time || 0}:00</span>
                    </span>
                </div>
            </div>

            <!-- ── Progress Bar ── -->
            <div class="test-progress-bar-wrap">
                <div class="test-progress-bar" id="testProgressBar" style="width:0%"></div>
            </div>
            <div class="test-progress-info">
                <span>Question <strong id="testCurNum">1</strong> of <strong>${qCount}</strong></span>
                <span id="testProgressPct">0%</span>
            </div>

            <!-- ── الأسئلة ── -->
            <div class="test-body">
                <div class="test-questions-wrap" id="testQuestionsWrap">
                    ${questions.map(function (q, qi) {
            var letters = ['A', 'B', 'C', 'D', 'E', 'F'];
            var opts = Array.isArray(q.opts) ? q.opts : [];
            return `
                        <div class="test-question-slide ${qi === 0 ? 'active' : ''}" id="testQ_${qi}" data-qi="${qi}">
                            <div class="test-q-num">Question ${qi + 1} of ${qCount}</div>
                            ${q.mediaUrl ? `<div class="test-q-img"><img src="${q.mediaUrl}" style="max-width:min(${q.imageWidth || 360}px, 100%);${q.imageHeight ? 'height:' + q.imageHeight + 'px;' : ''}object-fit:contain;border-radius:12px;border:1px solid var(--border);" loading="lazy"></div>` : ''}
                            <div class="test-q-text">${q.q || ''}</div>
                            <div class="test-options" id="testOpts_${qi}">
                                ${opts.map(function (opt, oi) {
                return `<button class="test-option" data-qi="${qi}" data-oi="${oi}" onclick="selectTestOption(${qi}, ${oi}, this)">
                                        <span class="test-opt-letter">${letters[oi] || (oi + 1)}</span>
                                        <span class="test-opt-text">${opt}</span>
                                        <span class="test-opt-check">✓</span>
                                    </button>`;
            }).join('')}
                            </div>
                            <div class="test-q-hint" id="testHint_${qi}" style="display:none;"></div>
                        </div>`;
        }).join('')}
                </div>

                <!-- ── ناف الأسئلة (أزرار مربعة) ── -->
                <div class="test-q-nav-grid" id="testQNavGrid">
                    ${questions.map(function (q, qi) {
            return `<button class="test-q-nav-dot ${qi === 0 ? 'current' : ''}" id="testNav_${qi}" onclick="goToTestQ(${qi})" title="Q${qi + 1}">${qi + 1}</button>`;
        }).join('')}
                </div>
            </div>

            <!-- ── أزرار التنقل ── -->
            <div class="test-footer">
                <button class="btn btn-outline" id="testPrevBtn" onclick="testNavQ(-1)" disabled>
                    &larr; Previous
                </button>
                <button class="btn btn-primary" id="testNextBtn" onclick="testNavQ(1)" ${qCount <= 1 ? 'style="display:none"' : ''}>
                    Next &rarr;
                </button>
                <button class="btn btn-accent" id="testSubmitBtn" onclick="confirmSubmitTest()" style="${qCount > 1 ? 'display:none' : ''}">
                    Submit Quiz ✅
                </button>
            </div>

            <!-- ── ملحوظة أسفل الصفحة ── -->
            <div class="test-note">
                <span>📌 You can navigate between questions before final submission</span>
                <span id="testAnsweredCount">0 / ${qCount} Answered</span>
            </div>

        </div>

        <!-- ── نافذة نتيجة الاختبار ── -->
        <div class="test-result-overlay" id="testResultOverlay" style="display:none;">
            <div class="test-result-modal" id="testResultModal">
                <div class="trm-icon" id="trmIcon">🎉</div>
                <h2 class="trm-title" id="trmTitle">Quiz Result</h2>
                <div class="trm-score" id="trmScore">—</div>
                <div class="trm-meta" id="trmMeta"></div>
                <div class="trm-review" id="trmReview"></div>
                <div id="trmGateMsg" style="display:none;margin-bottom:14px;padding:12px 18px;border-radius:14px;font-size:0.88rem;font-weight:700;text-align:center;"></div>
                <div class="trm-actions" id="trmActions">
                    <button class="btn btn-primary" onclick="navigate('${backUrl}')">&larr; Back to Lesson</button>
                </div>
            </div>
        </div>

        <style>
        /* ═══════════════════════════════════════════════
           TEST PAGE — Premium Redesign
           كل الـ id/class الوظيفية (زي .test-option, .selected,
           .correct, .wrong, .test-q-nav-dot, .answered, .current)
           اتسابت زي ما هي بالظبط عشان الـ JS شغال عليها مباشرة —
           التعديل هنا بصري (CSS) فقط.
           ═══════════════════════════════════════════════ */
        body { overflow-x: hidden; }
        .test-page {
            min-height: 100vh;
            display: flex; flex-direction: column;
            background:
                radial-gradient(1200px 600px at 15% -10%, rgba(6, 182, 212,0.06), transparent 60%),
                radial-gradient(1000px 500px at 100% 0%, rgba(59,130,246,0.05), transparent 55%),
                var(--bg-alt, #f8fafc);
            padding-top: var(--header-height, 70px);
            font-family: 'Tajawal', sans-serif;
        }
        /* Header */
        .test-header {
            background: var(--bg-surface, #fff);
            border-bottom: 1px solid var(--border, #e2e8f0);
            padding: 14px 24px;
            display: flex; align-items: center; gap: 14px;
            position: sticky; top: var(--header-height, 70px); z-index: 100;
            box-shadow: 0 2px 16px rgba(15,23,42,.05);
        }
        .test-back-btn {
            width: 38px; height: 38px; border: 1.5px solid var(--border, #e2e8f0);
            border-radius: 12px; background: var(--bg-alt, #f8fafc);
            font-size: 1.1rem; cursor: pointer; display: flex;
            align-items: center; justify-content: center;
            color: var(--text-primary, #0f172a); transition: background .2s, border-color .2s;
        }
        .test-back-btn:hover { background: var(--primary-50, #fff7ed); border-color: var(--primary-300, #67e8f9); }
        .test-header-info { flex: 1; min-width: 0; }
        .test-title { font-size: 1rem; font-weight: 900; color: var(--text-primary, #0f172a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .test-subject { font-size: .8rem; color: var(--text-secondary, #64748b); margin-top: 2px; }
        .test-timer-badge {
            background: linear-gradient(135deg, #CFFAFE, #A7F3D0);
            color: #065f46; border: 1px solid #34d399;
            border-radius: 20px; padding: 6px 14px;
            font-size: .85rem; font-weight: 800; white-space: nowrap;
            box-shadow: 0 2px 8px rgba(52,211,153,.25);
        }
        .test-timer-badge.warning { background: linear-gradient(135deg,#fee2e2,#fecaca); color: #dc2626; border-color: #fca5a5; animation: timerPulse 1s infinite; }
        @keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:.6} }

        /* Progress */
        .test-progress-bar-wrap {
            height: 6px; background: var(--border, #e2e8f0); position: relative;
        }
        .test-progress-bar {
            height: 100%; background: var(--accent-gradient, linear-gradient(90deg, #06B6D4, #0891B2));
            border-radius: 0 4px 4px 0; transition: width .4s ease;
        }
        .test-progress-info {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 24px; font-size: .82rem;
            color: var(--text-secondary, #64748b); font-weight: 700;
        }

        /* Body */
        .test-body {
            flex: 1; max-width: 720px; width: 100%;
            margin: 0 auto; padding: 24px 20px 0;
        }

        /* Question slides */
        .test-questions-wrap { position: relative; }
        .test-question-slide { display: none; animation: slideIn .3s ease; }
        .test-question-slide.active { display: block; }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

        /* ── Question badge (was a plain uppercase label) ── */
        .test-q-num {
            display: inline-flex; align-items: center; gap: 6px;
            font-size: .75rem; font-weight: 900; letter-spacing: .03em;
            color: #fff; text-transform: uppercase;
            background: var(--accent-gradient, linear-gradient(135deg, #06B6D4, #0891B2));
            padding: 6px 14px; border-radius: 999px;
            margin-bottom: 16px;
            box-shadow: 0 4px 12px rgba(6, 182, 212,.28);
        }
        .test-q-img { text-align: center; margin-bottom: 16px; }

        /* ── Question card: مساحة منفصلة تمامًا عن الاختيارات ── */
        .test-q-text {
            font-size: 1.15rem; font-weight: 800; line-height: 1.75;
            color: var(--text-primary, #0f172a);
            margin-bottom: 22px;
            background: var(--bg-surface, #fff);
            border: 1px solid var(--border, #e2e8f0);
            border-radius: 20px; padding: 24px 26px;
            box-shadow: 0 6px 24px rgba(15,23,42,.05);
            position: relative;
        }
        .test-q-text::before {
            content: '';
            position: absolute; inset-inline-start: 0; top: 14px; bottom: 14px;
            width: 4px; border-radius: 4px;
            background: var(--accent-gradient, linear-gradient(180deg, #06B6D4, #0891B2));
        }

        .test-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }

        /* ── Option card ── default / hover / selected حالات منفصلة تمامًا ── */
        .test-option {
            position: relative;
            display: flex; align-items: center; gap: 16px;
            background: var(--bg-surface, #fff);
            border: 2px solid var(--border, #e2e8f0);
            border-radius: 16px; padding: 16px 20px;
            cursor: pointer; text-align: right;
            font-family: 'Tajawal', sans-serif; font-size: .98rem; font-weight: 700;
            color: var(--text-primary, #0f172a);
            transition: border-color .18s ease, box-shadow .18s ease, transform .12s ease, background-color .18s ease;
            width: 100%;
        }
        /* Hover = حركة بسيطة وناعمة فقط، ومحدود بالحالة غير المختارة عشان
           ميتخلطش بصريًا مع .selected أبدًا مهما تحرك الماوس */
        .test-option:not(.selected):not(.correct):not(.wrong):hover {
            border-color: var(--primary-300, #67e8f9);
            box-shadow: 0 6px 18px rgba(15,23,42,.07);
            transform: translateY(-2px);
        }
        .test-option:active { transform: translateY(0) scale(.995); }

        /* Selected = حالة قوية وواضحة جدًا، مستقلة تمامًا عن hover */
        .test-option.selected {
            border-color: var(--primary-500, #06B6D4);
            background: var(--primary-50, #fff7ed);
            box-shadow: 0 8px 22px rgba(6, 182, 212,.16);
        }
        .test-option.correct  { border-color: #16a34a; background: #f0fdf4; }
        .test-option.wrong    { border-color: #dc2626; background: #fef2f2; }

        .test-opt-letter {
            min-width: 38px; height: 38px; border-radius: 50%;
            background: var(--bg-alt, #f1f5f9);
            display: flex; align-items: center; justify-content: center;
            font-size: .88rem; font-weight: 900; color: var(--primary-600, #0891B2);
            flex-shrink: 0; transition: background .18s, color .18s, transform .18s;
        }
        .test-option.selected .test-opt-letter {
            background: var(--accent-gradient, linear-gradient(135deg,#06B6D4,#0891B2));
            color: #fff; transform: scale(1.06);
        }
        .test-option.correct  .test-opt-letter { background: #16a34a; color: #fff; }
        .test-option.wrong    .test-opt-letter { background: #dc2626; color: #fff; }
        .test-opt-text { flex: 1; line-height: 1.6; }

        /* Check indicator — بيظهر بس مع .selected (نفس الكلاس اللي الجافاسكريبت
           بيحطه فعلاً، مفيش أي منطق جديد، مجرد عنصر بصري إضافي) */
        .test-opt-check {
            width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
            display: none; align-items: center; justify-content: center;
            background: var(--primary-500, #06B6D4); color: #fff;
            font-size: .78rem; font-weight: 900;
        }
        .test-option.selected .test-opt-check { display: flex; }
        .test-option.correct  .test-opt-check { display: flex; background: #16a34a; }
        .test-option.wrong    .test-opt-check { display: none; }

        .test-option:focus-visible {
            outline: 2.5px solid var(--primary-400, #22d3ee); outline-offset: 2px;
        }

        .test-q-hint {
            padding: 10px 14px; border-radius: 10px;
            font-size: .85rem; font-weight: 700; margin-top: 6px;
        }
        .test-q-hint.correct { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .test-q-hint.wrong   { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }

        /* ── Question Nav Grid — أرقام أنيقة بحالات واضحة ── */
        .test-q-nav-grid {
            display: flex; flex-wrap: wrap; gap: 10px;
            padding: 18px 0 6px; margin-top: 10px;
            border-top: 1px dashed var(--border, #e2e8f0);
        }
        .test-q-nav-dot {
            width: 40px; height: 40px; border-radius: 12px;
            border: 2px solid var(--border, #e2e8f0);
            background: var(--bg-surface, #fff);
            font-size: .85rem; font-weight: 800; cursor: pointer;
            color: var(--text-secondary, #64748b); transition: all .18s;
            position: relative;
        }
        .test-q-nav-dot:hover { border-color: var(--primary-300, #67e8f9); transform: translateY(-1px); }
        /* Answered = تم الإجابة (مش بالضرورة السؤال الحالي) */
        .test-q-nav-dot.answered { background: var(--primary-100, #ffedd5); border-color: var(--primary-300, #67e8f9); color: var(--primary-700, #0e7490); }
        /* Current = السؤال المعروض دلوقتي — Ring مميز يتراكب فوق أي حالة تانية */
        .test-q-nav-dot.current {
            border-color: var(--primary-500, #06B6D4);
            background: var(--accent-gradient, linear-gradient(135deg,#06B6D4,#0891B2));
            color: #fff;
            box-shadow: 0 0 0 4px rgba(6, 182, 212,.18);
        }

        /* Footer */
        .test-footer {
            max-width: 720px; width: 100%; margin: 0 auto;
            padding: 16px 20px 12px;
            display: flex; gap: 12px; justify-content: space-between;
        }
        .test-note {
            max-width: 720px; width: 100%; margin: 0 auto 20px;
            padding: 0 20px; display: flex; justify-content: space-between;
            font-size: .8rem; color: var(--text-muted, #94a3b8);
        }

        /* Result Modal */
        .test-result-overlay {
            position: fixed; inset: 0; background: rgba(15,23,42,.6);
            z-index: 9999; display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(6px); padding: 16px;
        }
        .test-result-modal {
            background: var(--bg-surface, #fff); border-radius: 28px;
            padding: 40px 32px; max-width: 480px; width: 100%;
            text-align: center; box-shadow: 0 32px 80px rgba(15,23,42,.25);
            animation: resultIn .4s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes resultIn { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
        .trm-icon { font-size: 4rem; margin-bottom: 12px; }
        .trm-title { font-size: 1.4rem; font-weight: 900; margin-bottom: 8px; color: var(--text-primary, #0f172a); }
        .trm-score { font-size: 3rem; font-weight: 900; margin: 12px 0; color: var(--primary-600, #0891B2); }
        .trm-meta { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 16px; font-size: .9rem; }
        .trm-meta-item { padding: 6px 14px; border-radius: 20px; font-weight: 700; }
        .trm-correct { background: #dcfce7; color: #16a34a; }
        .trm-wrong   { background: #fef2f2; color: #dc2626; }
        .trm-pct     { background: #FFF7ED; color: #0E7490; }
        .trm-review { max-height: 260px; overflow-y: auto; text-align: right; margin-bottom: 20px; }
        .trm-q-row {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 10px 0; border-bottom: 1px solid var(--border, #e2e8f0);
            font-size: .85rem;
        }
        .trm-q-row:last-child { border-bottom: none; }
        .trm-q-mark { font-size: 1rem; flex-shrink: 0; }
        .trm-q-info { flex: 1; }
        .trm-q-text { font-weight: 700; margin-bottom: 3px; }
        .trm-q-answer { color: var(--text-secondary, #64748b); }
        .trm-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

        /* Dark mode */
        [data-theme=dark] .test-page { background: #0b1220; }
        [data-theme=dark] .test-header { background: #111827; border-color: #1f2937; }
        [data-theme=dark] .test-q-text { background: #111827; border-color: #1f2937; color: #e2e8f0; }
        [data-theme=dark] .test-option { background: #111827; border-color: #1f2937; color: #e2e8f0; }
        [data-theme=dark] .test-option:not(.selected):not(.correct):not(.wrong):hover { border-color: var(--primary-500, #06B6D4); box-shadow: 0 6px 18px rgba(0,0,0,.35); }
        [data-theme=dark] .test-option.selected { background: rgba(6, 182, 212,.12); }
        [data-theme=dark] .test-opt-letter { background: #1e293b; }
        [data-theme=dark] .test-q-nav-dot { background: #1e293b; border-color: #334155; color: #94a3b8; }
        [data-theme=dark] .test-q-nav-dot.answered { background: rgba(6, 182, 212,.18); border-color: var(--primary-500,#06B6D4); color: var(--primary-300,#67e8f9); }
        [data-theme=dark] .test-result-modal { background: #111827; }
        [data-theme=dark] .trm-title { color: #e2e8f0; }

        @media (max-width: 600px) {
            .test-page { overflow-x: hidden; }
            .test-header { padding: 10px 12px; gap: 10px; }
            .test-title { font-size: .92rem; }
            .test-subject { font-size: .72rem; }
            .test-back-btn { width: 34px; height: 34px; font-size: 1rem; flex-shrink: 0; }
            .test-timer-badge { font-size: .78rem; padding: 5px 10px; flex-shrink: 0; }
            .test-progress-info { padding: 8px 14px; font-size: .76rem; }
            .test-body { padding: 14px 10px 0; }
            .test-q-num { font-size: .68rem; padding: 5px 12px; margin-bottom: 12px; }
            .test-q-text { font-size: 1rem; line-height: 1.65; padding: 16px 16px; margin-bottom: 16px; }
            .test-options { gap: 10px; }
            .test-option { padding: 14px 14px; font-size: .92rem; gap: 12px; min-height: 48px; }
            .test-opt-letter { min-width: 34px; height: 34px; font-size: .8rem; }
            .test-opt-check { width: 20px; height: 20px; font-size: .68rem; }
            .test-q-nav-grid { gap: 8px; padding: 14px 0 4px; }
            .test-q-nav-dot { width: 38px; height: 38px; font-size: .8rem; }
            .test-footer { padding: 10px 10px 14px; gap: 10px; }
            .test-footer .btn { flex: 1; min-height: 48px; font-size: .92rem; padding: 12px 10px; white-space: nowrap; }
            .test-note { flex-direction: column; gap: 4px; padding: 0 12px; font-size: .74rem; }
            .test-result-modal { padding: 26px 18px; border-radius: 22px; max-height: 90vh; overflow-y: auto; }
            .trm-icon { font-size: 3rem; }
            .trm-score { font-size: 2.1rem; margin: 8px 0; }
            .trm-title { font-size: 1.1rem; }
            .trm-meta { gap: 8px; font-size: .8rem; }
            .trm-meta-item { padding: 5px 10px; }
            .trm-actions { flex-direction: column; }
            .trm-actions .btn { width: 100%; min-height: 46px; }
        }

        /* منع أي Scroll أفقي بسبب صورة سؤال أعرض من الشاشة أو أي عنصر تاني */
        .test-page, .test-page * { max-width: 100%; box-sizing: border-box; }
        .test-q-text, .test-opt-text { overflow-wrap: break-word; word-break: break-word; }
        </style>
        `;
    }

    // ── Test Page Init — منطق التفاعل الحقيقي (منفصل عن renderTestPage) ──
    // ملحوظة مهمة جداً: أي <script> بيتحط جوه HTML عن طريق .innerHTML،
    // المتصفح بيتجاهله ومابيشغّلوش خالص (سلوك موثّق في كل المتصفحات) —
    // وده كان هو السبب الحقيقي وراء إن زر Next وتثبيت الإجابات ماكانوش
    // بيشتغلوا: الكود التفاعلي بالكامل كان جوه <script> زي ده جوه الـ
    // Template، ومكانش بينفّذ إطلاقاً بعد إدراج الصفحة. باقي صفحات المنصة
    // (زي renderLessonPage + initLessonPage) شغالة بنمط "render الـ HTML
    // الأول، وبعدين نداء دالة init() حقيقية منفصلة" — وده بالظبط اللي
    // طبّقته هنا عشان يتماشى مع باقي المنصة ويشتغل فعليًا هذه المرة.
    function initTestPage(quizId, courseId, lessonId) {
        (function() {
            // ── State ────────────────────────────────────────────────
            var _quiz      = window.getQuizById ? window.getQuizById(quizId) : null;
            var _questions = _quiz ? (_quiz.questionsList || []) : [];
            var _qCount    = _questions.length;
            var _answers   = {}; // qi → oi
            var _curQ      = 0;
            var _submitted = false;
            var _timer     = null;
            var _timeLeft  = (_quiz && _quiz.time) ? _quiz.time * 60 : 0;
            var _letters   = ['A','B','C','D','E','F'];

            // ── Select Option ─────────────────────────────────────────
            window.selectTestOption = function(qi, oi, btn) {
                if (_submitted) return;
                _answers[qi] = oi;

                // تحديث أزرار هذا السؤال
                var wrap = document.getElementById('testOpts_' + qi);
                if (wrap) {
                    wrap.querySelectorAll('.test-option').forEach(function(b) { b.classList.remove('selected'); });
                    btn.classList.add('selected');
                }

                // تحديث شبكة الأسئلة
                var navDot = document.getElementById('testNav_' + qi);
                if (navDot) navDot.classList.add('answered');

                // تحديث عداد الإجابات
                updateAnsweredCount();
                updateProgress();
            };

            function updateAnsweredCount() {
                var cnt = Object.keys(_answers).length;
                var el = document.getElementById('testAnsweredCount');
                if (el) el.textContent = cnt + ' / ' + _qCount + ' Answered';
            }

            function updateProgress() {
                var cnt = Object.keys(_answers).length;
                var pct = _qCount > 0 ? Math.round(cnt / _qCount * 100) : 0;
                var bar = document.getElementById('testProgressBar');
                var pctEl = document.getElementById('testProgressPct');
                if (bar) bar.style.width = pct + '%';
                if (pctEl) pctEl.textContent = pct + '%';
            }

            // ── Navigate Between Questions ────────────────────────────
            window.goToTestQ = function(qi) {
                if (qi < 0 || qi >= _qCount) return;

                // إخفاء الحالي
                var old = document.getElementById('testQ_' + _curQ);
                if (old) old.classList.remove('active');
                var oldNav = document.getElementById('testNav_' + _curQ);
                if (oldNav) oldNav.classList.remove('current');

                _curQ = qi;

                // إظهار الجديد
                var cur = document.getElementById('testQ_' + _curQ);
                if (cur) { cur.classList.add('active'); }
                var curNav = document.getElementById('testNav_' + _curQ);
                if (curNav) curNav.classList.add('current');

                // تحديث رقم السؤال
                var numEl = document.getElementById('testCurNum');
                if (numEl) numEl.textContent = _curQ + 1;

                // أزرار السابق/التالي/التسليم
                var prevBtn   = document.getElementById('testPrevBtn');
                var nextBtn   = document.getElementById('testNextBtn');
                var submitBtn = document.getElementById('testSubmitBtn');
                if (prevBtn)   prevBtn.disabled = (_curQ === 0);
                if (nextBtn)   nextBtn.style.display  = (_curQ < _qCount - 1) ? '' : 'none';
                if (submitBtn) submitBtn.style.display = (_curQ === _qCount - 1) ? '' : 'none';

                window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            window.testNavQ = function(dir) { window.goToTestQ(_curQ + dir); };

            // ── Confirm Submit ────────────────────────────────────────
            window.confirmSubmitTest = function() {
                var unanswered = _qCount - Object.keys(_answers).length;
                if (unanswered > 0) {
                    if (!confirm('You have ' + unanswered + ' unanswered question(s). Do you want to submit now?')) return;
                }
                submitTest();
            };

            // ── Submit & Grade ────────────────────────────────────────
            function submitTest() {
                if (_submitted) return;
                _submitted = true;
                if (_timer) clearInterval(_timer);

                var correct = 0, wrong = 0, skipped = 0;
                var totalPoints = 0, earnedPoints = 0;

                var reviewRows = _questions.map(function(q, qi) {
                    var chosen    = _answers[qi];
                    var isCorrect = (chosen !== undefined && chosen === q.correctOpt);
                    var pts       = q.points || 1;
                    totalPoints  += pts;
                    if (chosen === undefined) { skipped++; }
                    else if (isCorrect)       { correct++; earnedPoints += pts; }
                    else                      { wrong++; }

                    var chosenLabel = (chosen !== undefined && q.opts && q.opts[chosen]) ? _letters[chosen] + '. ' + q.opts[chosen] : '—';
                    var correctLabel = (q.opts && q.opts[q.correctOpt]) ? _letters[q.correctOpt] + '. ' + q.opts[q.correctOpt] : '—';

                    return '<div class="trm-q-row">' +
                        '<div class="trm-q-mark">' + (isCorrect ? '✅' : (chosen === undefined ? '⬜' : '❌')) + '</div>' +
                        '<div class="trm-q-info">' +
                            '<div class="trm-q-text">' + (qi + 1) + '. ' + (q.q || '').slice(0, 80) + (q.q && q.q.length > 80 ? '…' : '') + '</div>' +
                            '<div class="trm-q-answer">' +
                                '<span style="color:' + (isCorrect ? '#16a34a' : '#dc2626') + ';">Your answer: ' + chosenLabel + '</span>' +
                                (!isCorrect ? ' &nbsp;|&nbsp; <span style="color:#16a34a;">Correct answer: ' + correctLabel + '</span>' : '') +
                            '</div>' +
                        '</div></div>';
                }).join('');

                var pct   = totalPoints > 0 ? Math.round(earnedPoints / totalPoints * 100) : 0;
                var pass  = pct >= ((_quiz && _quiz.averageGrade) || 50);
                var emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪';

                // عرض النتيجة
                document.getElementById('trmIcon').textContent  = emoji;
                document.getElementById('trmTitle').textContent = pass ? 'Great Job! Quiz Passed' : 'Keep Practicing!';
                document.getElementById('trmScore').textContent = earnedPoints + ' / ' + totalPoints;
                document.getElementById('trmMeta').innerHTML =
                    '<span class="trm-meta-item trm-correct">✅ ' + correct + ' Correct</span>' +
                    '<span class="trm-meta-item trm-wrong">❌ ' + wrong + ' Wrong</span>' +
                    (skipped > 0 ? '<span class="trm-meta-item" style="background:#f1f5f9;color:#64748b;">⬜ ' + skipped + ' Skipped</span>' : '') +
                    '<span class="trm-meta-item trm-pct">' + pct + '%</span>';
                document.getElementById('trmReview').innerHTML = reviewRows;
                document.getElementById('testResultOverlay').style.display = 'flex';

                // quiz-gate: show pass/fail unlock message
                var _passRate = (_quiz && (_quiz.averageGrade || _quiz.passingGrade)) || 50;
                var _gateEl = document.getElementById('trmGateMsg');
                if (_gateEl) {
                    _gateEl.style.display = 'block';
                    if (pass) {
                        _gateEl.style.background = '#DCFCE7';
                        _gateEl.style.color = '#15803D';
                        _gateEl.style.border = '1px solid #86EFAC';
                        _gateEl.innerHTML = '&#10003; Passed! The next lesson is now unlocked.';
                    } else {
                        _gateEl.style.background = '#FEF2F2';
                        _gateEl.style.color = '#DC2626';
                        _gateEl.style.border = '1px solid #FECACA';
                        _gateEl.innerHTML = '&#128274; Score ' + pct + '% &mdash; need ' + _passRate + '% to unlock the next lesson. Please retake the quiz.';
                    }
                }

                // حفظ النتيجة — بنفس أسماء الحقول اللي شاشة "نتائج الاختبار"
                // في الداشبورد بتتوقعها فعليًا (studentName/studentId/totalPoints/
                // studentCode/elapsedTime)، + نفس الأسماء القديمة (userId/userName/
                // total) اللي باقي كود الطالب هنا بيعتمد عليها — نفس القيمة بس
                // باسمين، بدون ما نلمس أي كود تاني في الداشبورد أو في الطالب.
                if (window.saveQuizAttempt) {
                    var _uid = _userId || (window.currentUser && window.currentUser.id) || 'guest';
                    var _uname = (currentUser && currentUser.name) || (window.currentUser && window.currentUser.name) || '—';
                    var _ucode = (currentUser && (currentUser.code || currentUser.qrCode || currentUser.studentCode))
                        || (window.currentUser && (window.currentUser.code || window.currentUser.qrCode)) || _uid;
                    var attempt = {
                        userId:      _uid,
                        studentId:   _uid,
                        userName:    _uname,
                        studentName: _uname,
                        studentCode: _ucode,
                        quizId:      quizId,
                        courseId:    courseId,
                        lessonId:    lessonId,
                        quizTitle:   (_quiz && _quiz.title) || '—',
                        score:       earnedPoints,
                        total:       totalPoints,
                        totalPoints: totalPoints,
                        correct:     correct,
                        wrong:       wrong,
                        skipped:     skipped,
                        percentage:  pct,
                        passed:      pass,
                        answers:     _answers,
                        startedAt:   new Date(_startedAtMs).toISOString(),
                        submittedAt: new Date().toISOString(),
                        elapsedTime: Math.max(0, Math.floor((Date.now() - _startedAtMs) / 1000))
                    };
                    window.saveQuizAttempt(attempt);
                }

                // تعديل الخيارات لإظهار الصح والخطأ
                _questions.forEach(function(q, qi) {
                    var wrap = document.getElementById('testOpts_' + qi);
                    if (!wrap) return;
                    wrap.querySelectorAll('.test-option').forEach(function(btn, oi) {
                        btn.disabled = true;
                        if (oi === q.correctOpt) btn.classList.add('correct');
                        else if (_answers[qi] === oi) btn.classList.add('wrong');
                    });
                });
            }

            // ── Retake ────────────────────────────────────────────────
            window.retakeTest = function(qid, cid, lid) {
                navigate('test/' + [qid,cid,lid].filter(Boolean).join('/'));
            };

            // ── بدء/استئناف المحاولة من Backend (Firebase) ──────────────
            // ده اللي بيحدد الوقت المتبقي الحقيقي (مش quiz.time كاملة كل
            // مرة) ولو الطالب حل الاختبار فعلاً من قبل (حتى من جهاز تاني)
            var _startedAtMs = Date.now();
            var _userId = (currentUser && currentUser.id) || (window.currentUser && window.currentUser.id) || null;

            function startTimerAndShowQuestions() {
                if (_timeLeft > 0) {
                    var m0 = Math.floor(_timeLeft / 60), s0 = _timeLeft % 60;
                    var elDisp = document.getElementById('testTimerDisplay');
                    if (elDisp) elDisp.textContent = m0 + ':' + (s0 < 10 ? '0' : '') + s0;

                    _timer = setInterval(function() {
                        _timeLeft--;
                        var m = Math.floor(_timeLeft / 60);
                        var s = _timeLeft % 60;
                        var el = document.getElementById('testTimerDisplay');
                        if (el) el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
                        var badge = document.getElementById('testTimerBadge');
                        if (badge) badge.classList.toggle('warning', _timeLeft <= 60);
                        if (_timeLeft <= 0) {
                            clearInterval(_timer);
                            if (!_submitted) submitTest();
                        }
                    }, 1000);
                }
                window.goToTestQ(0);
                updateAnsweredCount();
                updateProgress();
            }

            if (_userId && typeof window.beginOrResumeQuizAttempt === 'function') {
                window.beginOrResumeQuizAttempt(_userId, quizId, courseId, lessonId, (_quiz && _quiz.time) ? _quiz.time * 60 : 0)
                    .then(function(result) {
                        if (result.already) {
                            // اتحل بالفعل (من أي جهاز) — بدّل المحتوى بصفحة "شاهد نتيجتك" فورًا
                            var appContent = document.getElementById('app-content');
                            if (appContent) {
                                appContent.innerHTML = renderAlreadyPassedQuizPage(_quiz, result.attempt, courseId, lessonId,
                                    (courseId && lessonId ? 'lesson/' + courseId + '/' + lessonId : (courseId ? 'license/' + courseId : 'courses')));
                            }
                            return;
                        }
                        _startedAtMs = result.startedAtMs || _startedAtMs;
                        if (result.remainingSeconds !== null && result.remainingSeconds !== undefined) {
                            _timeLeft = result.remainingSeconds;
                        }
                        if (_timeLeft <= 0 && (_quiz && _quiz.time)) {
                            // الوقت خلص فعلاً (مثلاً الطالب سايب الصفحة فاتحة) — سلّم فورًا
                            startTimerAndShowQuestions();
                            submitTest();
                            return;
                        }
                        startTimerAndShowQuestions();
                    })
                    .catch(function() { startTimerAndShowQuestions(); });
            } else {
                // لا يوجد مستخدم/Firebase متاح — نفس السلوك القديم بدون تغيير
                startTimerAndShowQuestions();
            }
        })();
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN PAGE — قائمة الكورسات للإدارة
    // ═══════════════════════════════════════════════════════════
    function renderAdminPage() {
        const rows = getAllCourses().map((c, i) => {
            const lessons = getCourseLessons(c.id);
            const contents = lessons.reduce((acc, l) => acc + getLessonContents(l.lessonId).length, 0);
            return `
            <div class="admin-course-row reveal reveal-delay-${(i % 3) + 1}">
                <div class="admin-course-row-icon">${c.icon}</div>
                <div class="admin-course-row-info">
                    <div class="admin-course-row-title">${c.title}</div>
                    <div class="admin-course-row-meta">
                        <span class="badge ${c.isFree ? 'badge-success' : 'badge-primary'}">  ${c.gradeTag}</span>
                        <span class="admin-meta-stat">📦 ${lessons.length} lessons</span>
                        <span class="admin-meta-stat">📋 ${contents} items</span>
                    </div>
                </div>
                <div class="admin-course-row-actions">
                    <button class="btn btn-primary btn-sm" onclick="navigate('admin-course/${c.id}')">
                        🗂 Manage Lessons
                    </button>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="admin-page">
            <div class="container">
                <div class="admin-page-header reveal">
                    <div>
                        <div class="section-badge"><span>🛠</span> Admin Panel</div>
                        <h1>Manage Courses &amp; Lessons</h1>
                        <p>Select a course to manage its lessons and content items</p>
                    </div>
                    <div class="admin-header-stats">
                        <div class="admin-stat-pill">
                            <span class="admin-stat-num">${getAllCourses().length}</span>
                            <span class="admin-stat-lbl">Courses</span>
                        </div>
                        <div class="admin-stat-pill">
                            <span class="admin-stat-num">${getLessons().length}</span>
                            <span class="admin-stat-lbl">Lessons</span>
                        </div>
                        <div class="admin-stat-pill">
                            <span class="admin-stat-num">${getContents().length}</span>
                            <span class="admin-stat-lbl">Contents</span>
                        </div>
                    </div>
                </div>
                <div class="admin-courses-list">
                    ${rows}
                </div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN COURSE PAGE — Manage Course Lessons
    // ═══════════════════════════════════════════════════════════
    function renderAdminCoursePage(courseId) {
        const course = getAllCourses().find(c => String(c.id) === String(courseId));
        if (!course) return render404Page();
        const lessons = getCourseLessons(courseId);

        const lessonsHTML = lessons.length === 0
            ? `<div class="admin-empty-lessons">
                <div style="font-size:3rem;">📭</div>
                <h3>No Lessons Yet</h3>
                <p>Click "Add New Lesson" to create the first lesson in this course</p>
               </div>`
            : lessons.map((lesson, li) => renderLessonBox(lesson, li)).join('');

        return `
        <div class="admin-course-page">
            <div class="container">

                <!-- Breadcrumb -->
                <div class="admin-breadcrumb reveal">
                    <a href="#admin" class="admin-breadcrumb-link">🛠 Admin</a>
                    <span class="admin-breadcrumb-sep">›</span>
                    <span>${course.title}</span>
                </div>

                <!-- Header -->
                <div class="admin-course-page-header reveal">
                    <div class="admin-course-page-info">
                        <div class="admin-course-page-icon">${course.icon}</div>
                        <div>
                            <h1>${course.title}</h1>
                            <div class="admin-course-page-meta">
                                <span class="badge ${course.isFree ? 'badge-success' : 'badge-primary'}">${course.gradeTag}</span>
                                <span>${lessons.length} lessons</span>
                                <span>${lessons.reduce((acc, l) => acc + getLessonContents(l.lessonId).length, 0)} items</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-lg" onclick="openLessonModal(null, '${courseId}')">
                        ＋ Add New Lesson
                    </button>
                </div>

                <!-- Lessons List -->
                <div class="admin-lessons-list" id="adminLessonsList">
                    ${lessonsHTML}
                </div>

            </div>
        </div>

        <!-- Lesson Modal -->
        <div class="admin-modal-overlay" id="lessonModalOverlay" onclick="closeLessonModal()">
            <div class="admin-modal" onclick="event.stopPropagation()" id="lessonModal">
                <div class="admin-modal-header">
                    <h3 id="lessonModalTitle">Add New Lesson</h3>
                    <button class="admin-modal-close" onclick="closeLessonModal()">✕</button>
                </div>
                <div class="admin-modal-body">
                    <input type="hidden" id="lessonModalId">
                    <input type="hidden" id="lessonModalCourseId" value="${courseId}">
                    <div class="form-group">
                        <label class="form-label">Lesson Title <span style="color:var(--danger)">*</span></label>
                        <input type="text" class="form-input" id="lessonModalName" placeholder="e.g. Introduction to Cell Biology" maxlength="120">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lesson Description</label>
                        <textarea class="form-input" id="lessonModalDesc" rows="3" placeholder="Brief overview of the lesson..." style="resize:vertical;"></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Order</label>
                            <input type="number" class="form-input" id="lessonModalOrder" min="1" value="${lessons.length + 1}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select class="form-select" id="lessonModalStatus">
                                <option value="published">Published ✅</option>
                                <option value="draft">Draft 📝</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="admin-modal-footer">
                    <button class="btn btn-ghost" onclick="closeLessonModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveLessonModal()">💾 Save Lesson</button>
                </div>
            </div>
        </div>

        <!-- Content Modal -->
        <div class="admin-modal-overlay" id="contentModalOverlay" onclick="closeContentModal()">
            <div class="admin-modal" onclick="event.stopPropagation()" id="contentModal">
                <div class="admin-modal-header">
                    <h3 id="contentModalTitle">Add Content</h3>
                    <button class="admin-modal-close" onclick="closeContentModal()">✕</button>
                </div>
                <div class="admin-modal-body">
                    <input type="hidden" id="contentModalId">
                    <input type="hidden" id="contentModalLessonId">
                    <div class="form-group">
                        <label class="form-label">Content Type</label>
                        <div class="content-type-grid" id="contentTypeGrid">
                            ${CONTENT_TYPES.map(t => `
                                <div class="content-type-btn" data-type="${t.value}" onclick="selectContentType('${t.value}')">
                                    <span class="ct-icon">${t.icon}</span>
                                    <span class="ct-label">${t.label}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Content Title <span style="color:var(--danger)">*</span></label>
                        <input type="text" class="form-input" id="contentModalName" placeholder="e.g. Video 1 — Overview">
                    </div>
                    <div class="form-group" id="contentUrlGroup">
                        <label class="form-label">Link / Content</label>
                        <input type="text" class="form-input" id="contentModalContent" placeholder="Video URL or PDF link..." dir="ltr">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Duration / Size</label>
                        <input type="text" class="form-input" id="contentModalDuration" placeholder="e.g. 25 min or 10 pages">
                    </div>
                </div>
                <div class="admin-modal-footer">
                    <button class="btn btn-ghost" onclick="closeContentModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveContentModal()">💾 Save Content</button>
                </div>
            </div>
        </div>

        <!-- Delete Confirm Modal -->
        <div class="admin-modal-overlay" id="deleteModalOverlay" onclick="closeDeleteModal()">
            <div class="admin-modal admin-modal-sm" onclick="event.stopPropagation()">
                <div class="admin-modal-header">
                    <h3>⚠️ Confirm Deletion</h3>
                    <button class="admin-modal-close" onclick="closeDeleteModal()">✕</button>
                </div>
                <div class="admin-modal-body" style="text-align:center;padding:var(--space-xl);">
                    <div style="font-size:3rem;margin-bottom:var(--space-md);">🗑️</div>
                    <p id="deleteModalMsg" style="font-size:1.05rem;">Are you sure you want to delete this?</p>
                    <p style="color:var(--text-muted);font-size:0.88rem;margin-top:8px;">This action cannot be undone.</p>
                </div>
                <div class="admin-modal-footer">
                    <button class="btn btn-ghost" onclick="closeDeleteModal()">Cancel</button>
                    <button class="btn btn-danger" id="deleteModalConfirmBtn">🗑 Delete</button>
                </div>
            </div>
        </div>`;
    }

    function renderLessonBox(lesson, index) {
        const contents = getLessonContents(lesson.lessonId);
        const isOpen = index === 0;

        const contentsHTML = contents.length === 0
            ? `<div class="lesson-box-empty">No content items yet — click "Add Content"</div>`
            : contents.map((c, ci) => {
                const typeConf = getContentTypeConfig(c.type);
                return `
                <div class="lesson-content-item" data-content-id="${c.contentId}" data-lesson-id="${lesson.lessonId}">
                    <div class="lci-drag-handle" title="Drag to reorder">⠿</div>
                    <div class="lci-order">${ci + 1}</div>
                    <div class="lci-type-icon">${typeConf.icon}</div>
                    <div class="lci-info">
                        <div class="lci-title">${c.title}</div>
                        <div class="lci-meta">
                            <span class="badge ${typeConf.badge}">${typeConf.label}</span>
                            ${c.duration ? `<span class="lci-duration">⏱ ${c.duration}</span>` : ''}
                        </div>
                    </div>
                    <div class="lci-actions">
                        <button class="btn-icon-sm" title="Edit" onclick="openContentModal('${lesson.lessonId}', '${c.contentId}')">✏️</button>
                        <button class="btn-icon-sm danger" title="Delete" onclick="confirmDeleteContent('${c.contentId}', '${lesson.courseId}')">🗑</button>
                    </div>
                </div>`;
            }).join('');

        return `
        <div class="lesson-box ${isOpen ? 'open' : ''} ${lesson.status === 'draft' ? 'draft' : ''}" data-lesson-id="${lesson.lessonId}" id="lesson-box-${lesson.lessonId}">
            <div class="lesson-box-header" onclick="toggleLessonBox('${lesson.lessonId}')">
                <div class="lesson-box-left">
                    <div class="lesson-box-drag" title="Drag to reorder">⠿</div>
                    <div class="lesson-box-order">${lesson.order}</div>
                    <div class="lesson-box-toggle-icon" id="toggle-icon-${lesson.lessonId}">${isOpen ? '▼' : '▶'}</div>
                    <div class="lesson-box-title-wrap">
                        <div class="lesson-box-title">${lesson.title}</div>
                        <div class="lesson-box-meta">
                            <span class="badge ${lesson.status === 'published' ? 'badge-success' : 'badge-ghost'}">
                                ${lesson.status === 'published' ? '✅ Published' : '📝 Draft'}
                            </span>
                            <span class="lesson-box-count">${contents.length} items</span>
                            ${lesson.description ? `<span class="lesson-box-desc-preview">${lesson.description.slice(0, 50)}${lesson.description.length > 50 ? '...' : ''}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="lesson-box-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-ghost btn-sm" title="Edit Lesson" onclick="openLessonModal('${lesson.lessonId}', '${lesson.courseId}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-ghost btn-sm danger-hover" title="Delete Lesson" onclick="confirmDeleteLesson('${lesson.lessonId}', '${lesson.courseId}')">
                        🗑 Delete
                    </button>
                </div>
            </div>
            <div class="lesson-box-body" id="lesson-box-body-${lesson.lessonId}">
                ${lesson.description ? `<div class="lesson-box-description">${lesson.description}</div>` : ''}
                <div class="lesson-contents-list" id="lesson-contents-${lesson.lessonId}">
                    ${contentsHTML}
                </div>
                <div class="lesson-box-footer">
                    <button class="btn btn-outline btn-sm" onclick="openContentModal('${lesson.lessonId}', null)">
                        ＋ Add Content
                    </button>
                </div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // DASHBOARD PAGE
    // ═══════════════════════════════════════════════════════════
    function renderDashboardPage() {
        const user = currentUser || {};
        const enrolledIds = user.enrolledCourses || [];
        const enrolled = getAllCourses().filter(c => enrolledIds.some(id => String(id) === String(c.id)));
        const completedLessons = user.completedLessons || 0;
        const avgScore = user.avgScore || 0;
        const initials = getUserInitials(user.name || '');

        return `
        <div class="dashboard-page">
            <div class="container">
                <div class="dashboard-welcome reveal">
                    <h2>Welcome back, ${user.name || 'Student'}! 👋</h2>
                    <p>Continue your learning journey — you're making wonderful progress!</p>
                </div>

                <div class="dashboard-stats">
                    <div class="dash-stat-card reveal reveal-delay-1">
                        <div class="dash-stat-icon green">📚</div>
                        <div class="dash-stat-info">
                            <div class="stat-val">${enrolled.length}</div>
                            <div class="stat-label">Enrolled Courses</div>
                        </div>
                    </div>
                    <div class="dash-stat-card reveal reveal-delay-2">
                        <div class="dash-stat-icon yellow">✅</div>
                        <div class="dash-stat-info">
                            <div class="stat-val">${completedLessons}</div>
                            <div class="stat-label">Completed Lessons</div>
                        </div>
                    </div>
                    <div class="dash-stat-card reveal reveal-delay-3">
                        <div class="dash-stat-icon blue">📊</div>
                        <div class="dash-stat-info">
                            <div class="stat-val">${avgScore}%</div>
                            <div class="stat-label">Average Score</div>
                        </div>
                    </div>
                    <div class="dash-stat-card reveal reveal-delay-4">
                        <div class="dash-stat-icon red">🔥</div>
                        <div class="dash-stat-info">
                            <div class="stat-val">${user.streak || 1}</div>
                            <div class="stat-label">Day Streak</div>
                        </div>
                    </div>
                </div>

                <div class="dashboard-grid">
                    <div class="enrolled-courses-card reveal">
                        <div class="card-header">
                            <h3>📚 Enrolled Courses</h3>
                            <a href="#courses" class="btn btn-ghost btn-sm">View All</a>
                        </div>
                        ${enrolled.length > 0 ? enrolled.map(c => {
            const allLessons = c.packages.flatMap(p => p.lessons);
            const completed = allLessons.filter(l => l.isCompleted).length;
            const pct = Math.round((completed / allLessons.length) * 100);
            return `
                            <div class="enrolled-course-item" onclick="navigate('license/${c.id}')">
                                <div class="enrolled-course-thumb">${c.icon}</div>
                                <div class="enrolled-course-info">
                                    <h4>${c.title}</h4>
                                    <div class="progress-text">${completed} of ${allLessons.length} lessons completed (${pct}%)</div>
                                    <div class="progress-bar sm">
                                        <div class="progress-fill" style="width:${pct}%;"></div>
                                    </div>
                                </div>
                            </div>`;
        }).join('') : `
                            <div class="empty-state">
                                <div class="empty-state-icon">📚</div>
                                <h3>No Enrolled Courses</h3>
                                <p>Browse available courses and start learning today!</p>
                                <a href="#courses" class="btn btn-primary">Browse Courses</a>
                            </div>
                        `}
                    </div>

                    <div class="activity-card reveal reveal-delay-1">
                        <div class="card-header">
                            <h3>⚡ Recent Activity</h3>
                        </div>
                        ${ACTIVITY_DATA.map(a => `
                            <div class="activity-item">
                                <div class="activity-icon" style="background:var(--${a.color === 'green' ? 'success-light' : a.color === 'yellow' ? 'accent-50' : a.color === 'blue' ? 'info-light' : 'danger-light'});color:var(--${a.color === 'green' ? 'success' : a.color === 'yellow' ? 'accent-500' : a.color === 'blue' ? 'info' : 'danger'});">
                                    ${a.icon}
                                </div>
                                <div>
                                    <div class="activity-text">${a.text}</div>
                                    <div class="activity-time">${a.time}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // PROFILE PAGE
    // ═══════════════════════════════════════════════════════════
    function renderProfilePage() {
        const user = currentUser || {};
        const initials = getUserInitials(user.name || '');
        const grades = [
            '1st Year Preparatory',
            '2nd Year Preparatory',
            '3rd Year Preparatory',
            '1st Year Secondary',
            '2nd Year Secondary',
            '2nd Year Secondary — General',
            '2nd Year Secondary — Baccalaureate',
            '3rd Year Secondary'
        ];
        const govs = [
            'Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Beheira', 'Fayoum', 'Gharbia',
            'Ismailia', 'Menofia', 'Minya', 'Qalyubia', 'New Valley', 'Suez', 'Aswan',
            'Assiut', 'Beni Suef', 'Port Said', 'Damietta', 'Sharqia', 'South Sinai',
            'Kafr El Sheikh', 'Matrouh', 'Luxor', 'Qena', 'North Sinai', 'Sohag', 'Red Sea'
        ];
        return `
        <div class="profile-page">
            <div class="container">
                <div class="profile-header-card reveal">
                    <div class="profile-avatar">${initials}</div>
                    <div class="profile-info">
                        <h2>${user.name || 'Student'}</h2>
                        <div class="profile-email">${user.phone || ''}</div>
                        <div class="profile-badges">
                            <span class="badge badge-primary">🎓 ${user.grade || 'Student'}</span>
                            <span class="badge badge-accent">⭐ Outstanding Student</span>
                        </div>
                    </div>
                </div>

                <div class="profile-grid">
                    <div class="profile-section reveal reveal-delay-1">
                        <h3>👤 Personal Information</h3>
                        <form onsubmit="event.preventDefault(); saveProfileChanges();">
                            <div class="form-group">
                                <label class="form-label">Full Name</label>
                                <input type="text" class="form-input" id="profileName" value="${user.name || ''}" placeholder="Enter your full name">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Student Phone Number</label>
                                <input type="tel" class="form-input phone-input" id="profilePhone" value="${user.phone || ''}" dir="ltr" maxlength="11" inputmode="numeric" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11)">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Parent's Phone Number</label>
                                <input type="tel" class="form-input phone-input" id="profileParentPhone" value="${user.parentPhone || ''}" dir="ltr" maxlength="11" inputmode="numeric" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11)">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Academic Grade</label>
                                <select class="form-select" id="profileGrade">
                                    ${grades.map(g => `<option ${user.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Governorate</label>
                                <select class="form-select" id="profileGovernorate">
                                    ${govs.map(g => `<option ${user.governorate === g ? 'selected' : ''}>${g}</option>`).join('')}
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary">Save Changes</button>
                        </form>
                    </div>

                    <div class="profile-section reveal reveal-delay-2">
                        <h3>🔒 Security</h3>
                        <form onsubmit="event.preventDefault(); changePassword();">
                            <div class="form-group">
                                <label class="form-label">Current Password</label>
                                <input type="password" class="form-input" placeholder="Enter current password" id="currentPasswordInput">
                            </div>
                            <div class="form-group">
                                <label class="form-label">New Password (at least 6 characters)</label>
                                <input type="password" class="form-input" placeholder="6+ alphanumeric characters" id="newPasswordInput">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Confirm New Password</label>
                                <input type="password" class="form-input" placeholder="Re-enter new password" id="confirmPasswordInput">
                            </div>
                            <button type="submit" class="btn btn-primary">Update Password</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // LOGIN PAGE — يستخدم templates.js إذا كان محمّلاً
    // ═══════════════════════════════════════════════════════════
    function renderLoginPage() {
        // استخدام القالب المفصول إذا كان متاحاً
        if (window.Templates && window.Templates.loginPage) {
            return window.Templates.loginPage(SITE_CONFIG.name);
        }
        // Fallback: الكود الأصلي
        return _renderLoginPageFallback();
    }
    function _renderLoginPageFallback() {
        return `
        <div class="auth-page">
            <div class="auth-visual">
                <div class="auth-visual-mesh"></div>
                <div class="auth-visual-content">
                    <div class="auth-teacher-badge">
                        <img src="teacher-new.jpg?v=20260912" alt="Mr. Islam Abdelwahed" class="auth-t-img" onerror="this.src='صورة المدرس الجديد.jpeg'">
                        <div class="auth-t-info">
                            <div class="auth-t-crown">👑</div>
                            <div class="auth-t-name">Mr. Islam Abdelwahed</div>
                            <div class="auth-t-sub">Senior Biology Expert &amp; Educator 🔬</div>
                        </div>
                    </div>

                    <h2 class="auth-visual-title">Welcome Back to Your Platform! ✨</h2>
                    <p class="auth-visual-desc">Sign in to access your video lectures, practice exercises, and track your quiz performance in real time.</p>

                    <div class="auth-stats-grid">
                        <div class="auth-stat-card">
                            <div class="auth-stat-num">+10,000</div>
                            <div class="auth-stat-lbl">Top Students</div>
                        </div>
                        <div class="auth-stat-card">
                            <div class="auth-stat-num">100%</div>
                            <div class="auth-stat-lbl">Full Score Rate</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="auth-form-side">
                <div class="auth-form-card">
                    <div class="auth-card-header">
                        <a href="#home" class="auth-logo-badge">
                            <span class="auth-logo-icon">🔬</span>
                            <span class="auth-logo-text">${SITE_CONFIG.name}</span>
                        </a>
                        <h1 class="auth-heading">Sign In</h1>
                        <p class="auth-subtitle">Enter your registered phone number and password to continue</p>
                    </div>

                    <div id="loginErrorMsg" class="auth-alert-error" style="display:none;"></div>

                    <form class="auth-form" onsubmit="event.preventDefault(); handleLogin();" id="loginForm" novalidate>
                        <div class="form-group">
                            <div class="form-label-row">
                                <label class="form-label">📱 Student Phone Number</label>
                                <span class="phone-len-counter" id="loginPhoneCounter">0 / 11 digits</span>
                            </div>
                            <div class="form-input-icon-wrapper">
                                <span class="form-input-icon">📱</span>
                                <input type="tel" class="form-input phone-input" placeholder="01xxxxxxxxx" required id="loginPhone" dir="ltr" maxlength="11" inputmode="numeric" autocomplete="tel" oninput="handlePhoneInputLive(this, 'loginPhoneCounter')">
                            </div>
                            <div class="form-hint" id="loginPhoneHint">Must be 11 digits starting with 01 (digits only)</div>
                        </div>

                        <div class="form-group">
                            <div class="form-label-row">
                                <label class="form-label">🔒 Password</label>
                                <a href="#" onclick="event.preventDefault(); showToast('Contact support via WhatsApp to reset your password', 'info');" class="forgot-pw-link">Forgot password?</a>
                            </div>
                            <div class="form-input-icon-wrapper" style="position:relative;">
                                <span class="form-input-icon">🔒</span>
                                <input type="password" class="form-input" placeholder="Enter your password" required id="loginPassword" autocomplete="current-password">
                                <span class="password-toggle" onclick="togglePassword('loginPassword', this)" title="Show/Hide password">👁️</span>
                            </div>
                        </div>

                        <div class="form-options-row">
                            <label class="remember-label">
                                <input type="checkbox" checked class="custom-checkbox">
                                <span>Remember me on this device</span>
                            </label>
                        </div>

                        <button type="submit" class="btn btn-auth-submit" id="loginSubmitBtn">
                            <span>Sign In</span>
                            <span class="btn-arrow-icon">→</span>
                        </button>
                    </form>

                    <div class="auth-footer-box">
                        <span>Don't have an account yet?</span>
                        <a href="#register" class="auth-switch-link">Create Free Account ✨</a>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // REGISTER PAGE — Uses templates.js if loaded
    // ═══════════════════════════════════════════════════════════
    function renderRegisterPage() {
        if (window.Templates && window.Templates.registerPage) {
            return window.Templates.registerPage(SITE_CONFIG.name);
        }
        return _renderRegisterPageFallback();
    }
    function _renderRegisterPageFallback() {
        return `
        <div class="auth-page">
            <div class="auth-visual">
                <div class="auth-visual-mesh"></div>
                <div class="auth-visual-content">
                    <div class="auth-teacher-badge">
                        <img src="teacher-new.jpg?v=20260912" alt="Mr. Islam Abdelwahed" class="auth-t-img" onerror="this.src='صورة المدرس الجديد.jpeg'">
                        <div class="auth-t-info">
                            <div class="auth-t-crown">👑</div>
                            <div class="auth-t-name">Mr. Islam Abdelwahed</div>
                            <div class="auth-t-sub">Senior Biology Expert &amp; Educator 🔬</div>
                        </div>
                    </div>

                    <h2 class="auth-visual-title">Join the Elite in Biology! 🎓</h2>
                    <p class="auth-visual-desc">Create your free account in seconds and unlock exclusive structured explanations and interactive quizzes.</p>

                    <div class="auth-features-list">
                        <div class="auth-feat-item">
                            <span class="auth-feat-icon">✨</span>
                            <span>Clear, structured step-by-step mathematical explanations</span>
                        </div>
                        <div class="auth-feat-item">
                            <span class="auth-feat-icon">🎯</span>
                            <span>Comprehensive exams with instant grading and model answers</span>
                        </div>
                        <div class="auth-feat-item">
                            <span class="auth-feat-icon">📊</span>
                            <span>Continuous progress tracking and performance analytics</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="auth-form-side">
                <div class="auth-form-card auth-register-card">
                    <div class="auth-card-header">
                        <a href="#home" class="auth-logo-badge">
                            <span class="auth-logo-icon">🔬</span>
                            <span class="auth-logo-text">${SITE_CONFIG.name}</span>
                        </a>
                        <h1 class="auth-heading">Create Account</h1>
                        <p class="auth-subtitle">Fill in your academic details to join the platform</p>
                    </div>

                    <div id="registerErrorMsg" class="auth-alert-error" style="display:none;"></div>

                    <form class="auth-form" onsubmit="event.preventDefault(); handleRegister();" id="registerForm" novalidate>
                        <!-- Full Name -->
                        <div class="form-group">
                            <label class="form-label">👤 Student Full Name</label>
                            <div class="form-input-icon-wrapper">
                                <span class="form-input-icon">👤</span>
                                <input type="text" class="form-input" placeholder="e.g. Ahmed Mohamed Ali" required id="registerFullName" autocomplete="name">
                            </div>
                        </div>

                        <!-- Phone numbers -->
                        <div class="form-row-auth">
                            <div class="form-group">
                                <div class="form-label-row">
                                    <label class="form-label">📱 Student Phone</label>
                                    <span class="phone-len-counter" id="regPhoneCounter">0 / 11 digits</span>
                                </div>
                                <div class="form-input-icon-wrapper">
                                    <span class="form-input-icon">📱</span>
                                    <input type="tel" class="form-input phone-input" placeholder="01xxxxxxxxx" required dir="ltr" id="registerPhone" maxlength="11" inputmode="numeric" autocomplete="tel" oninput="handlePhoneInputLive(this, 'regPhoneCounter')">
                                </div>
                            </div>

                            <div class="form-group">
                                <div class="form-label-row">
                                    <label class="form-label">📞 Parent's Phone</label>
                                    <span class="phone-len-counter" id="regParentPhoneCounter">0 / 11 digits</span>
                                </div>
                                <div class="form-input-icon-wrapper">
                                    <span class="form-input-icon">📞</span>
                                    <input type="tel" class="form-input phone-input" placeholder="01xxxxxxxxx" required dir="ltr" id="registerParentPhone" maxlength="11" inputmode="numeric" autocomplete="tel" oninput="handlePhoneInputLive(this, 'regParentPhoneCounter')">
                                </div>
                            </div>
                        </div>

                        <!-- Grade & Governorate -->
                        <div class="form-row-auth">
                            <div class="form-group">
                                <label class="form-label">📚 Academic Grade</label>
                                <select class="form-select" required id="registerGrade" onchange="handleGradeChange(this.value)">
                                    <option value="" disabled selected>Select your grade</option>
                                    <optgroup label="Preparatory Stage">
                                        <option value="1st Year Preparatory">1st Year Preparatory</option>
                                        <option value="2nd Year Preparatory">2nd Year Preparatory</option>
                                        <option value="3rd Year Preparatory">3rd Year Preparatory</option>
                                    </optgroup>
                                    <optgroup label="Secondary Stage">
                                        <option value="1st Year Secondary">1st Year Secondary</option>
                                        <option value="2nd Year Secondary">2nd Year Secondary</option>
                                        <option value="2nd Year Secondary — Programming">2nd Year Secondary — Programming</option>
                                        <option value="Baccalaureate Programming">Baccalaureate Programming</option>
                                        <option value="3rd Year Secondary">3rd Year Secondary</option>
                                    </optgroup>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">🏛️ Governorate</label>
                                <select class="form-select" required id="registerGovernorate">
                                    <option value="" disabled selected>Select your governorate</option>
                                    <option>Cairo</option><option>Giza</option><option>Alexandria</option>
                                    <option>Dakahlia</option><option>Beheira</option><option>Fayoum</option>
                                    <option>Gharbia</option><option>Ismailia</option><option>Menofia</option>
                                    <option>Minya</option><option>Qalyubia</option><option>New Valley</option>
                                    <option>Suez</option><option>Aswan</option><option>Assiut</option>
                                    <option>Beni Suef</option><option>Port Said</option><option>Damietta</option>
                                    <option>Sharqia</option><option>South Sinai</option><option>Kafr El Sheikh</option>
                                    <option>Matrouh</option><option>Luxor</option><option>Qena</option>
                                    <option>North Sinai</option><option>Sohag</option><option>Red Sea</option>
                                </select>
                            </div>
                        </div>

                        <!-- Section (For 2nd Secondary) -->
                        <div class="form-group" id="sectionGroup" style="display:none;">
                            <label class="form-label">🔬 Choose Section</label>
                            <div class="section-radio-pills">
                                <label class="radio-pill-card">
                                    <input type="radio" name="registerSection" value="General" id="sectionAmm">
                                    <span>📖 General (Science / Arts)</span>
                                </label>
                                <label class="radio-pill-card">
                                    <input type="radio" name="registerSection" value="Baccalaureate" id="sectionBak">
                                    <span>🎓 International Baccalaureate / Languages</span>
                                </label>
                            </div>
                        </div>

                        <!-- Password & Confirm -->
                        <div class="form-row-auth">
                            <div class="form-group">
                                <label class="form-label">🔒 Password <small>(6+ characters)</small></label>
                                <div class="form-input-icon-wrapper" style="position:relative;">
                                    <span class="form-input-icon">🔒</span>
                                    <input type="password" class="form-input" placeholder="Enter password" required id="registerPassword" oninput="checkPasswordStrength(this.value)" autocomplete="new-password">
                                    <span class="password-toggle" onclick="togglePassword('registerPassword', this)">👁️</span>
                                </div>
                                <div class="password-strength-bar" id="passwordStrengthBar" style="margin-top:6px;height:4px;border-radius:4px;background:var(--border);overflow:hidden;display:none;">
                                    <div id="passwordStrengthFill" style="height:100%;border-radius:4px;transition:all 0.3s;"></div>
                                </div>
                                <div id="passwordStrengthText" style="font-size:0.75rem;margin-top:4px;"></div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">🔒 Confirm Password</label>
                                <div class="form-input-icon-wrapper" style="position:relative;">
                                    <span class="form-input-icon">🔒</span>
                                    <input type="password" class="form-input" placeholder="Re-enter password" required id="registerConfirmPassword" autocomplete="new-password">
                                    <span class="password-toggle" onclick="togglePassword('registerConfirmPassword', this)">👁️</span>
                                </div>
                            </div>
                        </div>

                        <!-- Terms Agreement -->
                        <div class="form-options-row">
                            <label class="remember-label">
                                <input type="checkbox" required class="custom-checkbox" id="registerTerms" checked>
                                <span>I agree to the <a href="#" onclick="event.preventDefault(); showToast('Our terms ensure full privacy and protection of your data.', 'info');" class="auth-link-terms">Terms of Service &amp; Privacy Policy</a></span>
                            </label>
                        </div>

                        <button type="submit" class="btn btn-auth-submit" id="registerSubmitBtn">
                            <span>Create Account Now</span>
                            <span class="btn-arrow-icon">✨</span>
                        </button>
                    </form>

                    <div class="auth-footer-box">
                        <span>Already have an account?</span>
                        <a href="#login" class="auth-switch-link">Sign In directly →</a>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // 404 PAGE — Uses templates.js if loaded
    // ═══════════════════════════════════════════════════════════
    function render404Page() {
        if (window.Templates && window.Templates.page404) {
            return window.Templates.page404();
        }
        return `
        <div style="padding:calc(var(--header-height) + var(--space-4xl)) 0 var(--space-4xl);">
            <div class="container">
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3>Page Not Found</h3>
                    <p>The page you are looking for does not exist or has been moved.</p>
                    <a href="#home" class="btn btn-primary">Back to Home</a>
                </div>
            </div>
        </div>`;
    }


    // ═══════════════════════════════════════════════════════════
    // INTERACTIONS & HANDLERS
    // ═══════════════════════════════════════════════════════════

    // Mobile menu
    window.toggleMobileMenu = function () {
        mobileMenuOpen = !mobileMenuOpen;
        document.getElementById('mobileOverlay').classList.toggle('show', mobileMenuOpen);
        document.getElementById('mobileMenu').classList.toggle('show', mobileMenuOpen);
        document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    };
    window.closeMobileMenu = function () {
        mobileMenuOpen = false;
        const overlay = document.getElementById('mobileOverlay');
        const menu = document.getElementById('mobileMenu');
        if (overlay) overlay.classList.remove('show');
        if (menu) menu.classList.remove('show');
        document.body.style.overflow = '';
    };

    // Avatar dropdown
    window.toggleAvatarDropdown = function () {
        const dd = document.getElementById('avatarDropdown');
        if (dd) dd.classList.toggle('show');
    };

    // Close dropdown on outside click
    document.addEventListener('click', function (e) {
        const avatar = document.getElementById('headerAvatar');
        const dd = document.getElementById('avatarDropdown');
        if (dd && avatar && !avatar.contains(e.target)) {
            dd.classList.remove('show');
        }
    });

    // Lesson sidebar toggle (mobile)
    window.toggleLessonSidebar = function (forceState) {
        if (typeof forceState === 'boolean') {
            lessonSidebarOpen = forceState;
        } else {
            lessonSidebarOpen = !lessonSidebarOpen;
        }
        const sb = document.getElementById('lessonSidebar');
        const bd = document.getElementById('lessonSidebarBackdrop');
        if (sb) sb.classList.toggle('show', lessonSidebarOpen);
        if (bd) bd.classList.toggle('show', lessonSidebarOpen);
    };

    // Package toggle (course details)
    window.togglePackage = function (header) {
        header.classList.toggle('open');
        const lessons = header.nextElementSibling;
        if (lessons) lessons.classList.toggle('open');
    };

    // License page accordion toggle
    window.toggleAccordion = function (pi) {
        const lessons = document.getElementById('acc-lessons-' + pi);
        const pkg = document.getElementById('acc-pkg-' + pi);
        if (!lessons) return;
        const isOpen = lessons.classList.contains('open');
        lessons.classList.toggle('open', !isOpen);
        pkg.classList.toggle('open', !isOpen);
    };

    // Lesson in-page packages accordion toggle
    window.toggleInpageAccordion = function (pi) {
        const lessons = document.getElementById('inpage-lessons-' + pi);
        const pkg = document.getElementById('inpage-pkg-' + pi);
        if (!lessons) return;
        const isOpen = lessons.classList.contains('open');
        lessons.classList.toggle('open', !isOpen);
        if (pkg) pkg.classList.toggle('open', !isOpen);
    };

    // ── License codes DB ─────────────────────────────────────────
    // أكواد التفعيل تُخزَّن في localStorage + Firebase Firestore
    const CODES_KEY = 'iraqiplatform_codes';

    function getCodes() {
        try { return JSON.parse(localStorage.getItem(CODES_KEY)) || []; }
        catch (e) { return []; }
    }
    function saveCodes(codes) {
        localStorage.setItem(CODES_KEY, JSON.stringify(codes));
        if (typeof window.FirebaseService !== 'undefined' && window.FirebaseService.codes) {
            try { (codes || []).forEach(c => window.FirebaseService.codes.save(c)); } catch (e) { }
        }
    }

    // البحث المباشر في Firebase عن كود تفعيل (لما يكون الـ localStorage فارغ)
    async function findCodeInFirebase(code) {
        const db = (window.FirebaseService && typeof window.FirebaseService.getDb === 'function')
            ? window.FirebaseService.getDb()
            : (window.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null));
        if (!db) return null;
        try {
            // بحث بالـ ID المباشر (الكود نفسه كـ Document ID)
            const docSnap = await db.collection('codes').doc(code.toUpperCase()).get();
            if (docSnap.exists) return Object.assign({ id: docSnap.id }, docSnap.data());
            // بحث في alsaqr_vouchers collection (backup)
            const q = await db.collection('codes').where('code', '==', code.toUpperCase()).limit(1).get();
            if (!q.empty) return Object.assign({ id: q.docs[0].id }, q.docs[0].data());
        } catch (e) { console.warn('[findCodeInFirebase]', e.message); }
        return null;
    }

    // مزامنة أكواد التفعيل من Firebase إلى localStorage عند التحميل
    async function syncCodesFromFirebase() {
        const db = (window.FirebaseService && typeof window.FirebaseService.getDb === 'function')
            ? window.FirebaseService.getDb()
            : (window.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null));
        if (!db) return;
        try {
            const snap = await db.collection('codes').get();
            if (snap.empty) return;
            const fbCodes = [];
            snap.forEach(d => fbCodes.push(Object.assign({ id: d.id }, d.data())));
            // دمج مع المحلي
            const localMap = {};
            getCodes().forEach(c => { if (c.code) localMap[String(c.code).toUpperCase()] = c; });
            fbCodes.forEach(c => { if (c.code) localMap[String(c.code).toUpperCase()] = c; });
            localStorage.setItem(CODES_KEY, JSON.stringify(Object.values(localMap)));
            console.log('[syncCodesFromFirebase] ✅ Synced', fbCodes.length, 'codes');
        } catch (e) { console.warn('[syncCodesFromFirebase]', e.message); }
    }

    // License code activation with Cloud Firestore & fallback
    window.activateLicenseCode = async function (courseId) {
        if (!isLoggedIn || !currentUser) {
            sessionStorage.setItem('iraqiplatform_redirect', 'license/' + courseId);
            showToast('Please sign in first to activate this course', 'error');
            navigate('login');
            return;
        }

        const input = document.getElementById('licenseCodeInput');
        const btn = document.getElementById('activateLicenseBtn');
        const code = (input ? input.value : '').trim().toUpperCase();

        if (!code) {
            showToast('⚠️ Please enter an activation code first', 'error');
            if (input) input.focus();
            return;
        }

        if (btn) {
            btn.textContent = '⏳ Verifying code...';
            btn.disabled = true;
        }

        try {
            let foundCode = null;
            let source = 'local';

            // 1. Search in Firebase Firestore first
            const db = (window.FirebaseService && typeof window.FirebaseService.getDb === 'function')
                ? window.FirebaseService.getDb()
                : (window.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null));

            if (db) {
                try {
                    const docSnap = await db.collection('codes').doc(code).get();
                    if (docSnap.exists) {
                        foundCode = Object.assign({ id: docSnap.id }, docSnap.data());
                        source = 'firestore';
                    } else {
                        const qSnap = await db.collection('codes').where('code', '==', code).limit(1).get();
                        if (!qSnap.empty) {
                            foundCode = Object.assign({ id: qSnap.docs[0].id }, qSnap.docs[0].data());
                            source = 'firestore';
                        }
                    }
                } catch (e) {
                    console.warn('[Activation] Firestore lookup notice:', e.message);
                }
            }

            // 2. Search local storage fallback
            if (!foundCode) {
                const localCodes = getCodes();
                foundCode = localCodes.find(c => (c.code || '').toUpperCase() === code);

                if (!foundCode) {
                    try {
                        const vouchers = JSON.parse(localStorage.getItem('alsaqr_vouchers') || '[]');
                        const v = vouchers.find(x => (x.code || '').toUpperCase() === code);
                        if (v) {
                            foundCode = {
                                id: String(v.id || v.code),
                                code: (v.code || '').toUpperCase(),
                                courseId: String(v.courseId || ''),
                                courseTitle: v.courseTitle || '',
                                status: v.status || 'unused',
                                used: v.status === 'used' || v.used || false,
                                usedBy: v.usedBy || (v.linkedStudentId ? String(v.linkedStudentId) : null),
                                usedByPhone: v.usedByPhone || v.linkedStudentPhone || null,
                                linkedStudentName: v.linkedStudentName || '',
                                linkedStudentPhone: v.linkedStudentPhone || '',
                                codeType: v.codeType || 'generic'
                            };
                        }
                    } catch (e) { }
                }

                // 3. Fallback direct search
                if (!foundCode) {
                    foundCode = await findCodeInFirebase(code);
                    if (foundCode) {
                        const allLocalCodes = getCodes();
                        if (!allLocalCodes.some(c => (c.code || '').toUpperCase() === code)) {
                            allLocalCodes.push(foundCode);
                            saveCodes(allLocalCodes);
                        }
                    }
                }
            }

            if (!foundCode) {
                showToast('❌ This code is invalid or does not exist in the system', 'error');
                if (btn) { btn.textContent = 'Activate Code Now ✅'; btn.disabled = false; }
                if (input) { input.value = ''; input.focus(); }
                return;
            }

            const targetCourseId = String(courseId || '');
            const codeCourseId = String(foundCode.courseId || '');
            if (codeCourseId && codeCourseId !== targetCourseId && codeCourseId !== 'all') {
                showToast('⚠️ This code is assigned to a different course', 'error');
                if (btn) { btn.textContent = 'Activate Code Now ✅'; btn.disabled = false; }
                return;
            }

            const isUsed = foundCode.used === true || foundCode.status === 'مستخدم' || foundCode.status === 'used';
            if (isUsed) {
                const isMyCode = (foundCode.usedBy && String(foundCode.usedBy) === String(currentUser.id)) ||
                    (foundCode.usedByPhone && currentUser.phone && String(foundCode.usedByPhone) === String(currentUser.phone)) ||
                    (foundCode.linkedStudentPhone && currentUser.phone && String(foundCode.linkedStudentPhone) === String(currentUser.phone));

                if (isMyCode) {
                    await enrollStudentInCourse(targetCourseId);
                    showToast('✅ Course already activated on your account — Opening first lesson...', 'success');
                    launchFirstLesson(targetCourseId);
                    return;
                } else {
                    showToast('❌ This activation code has already been used by another student', 'error');
                    if (btn) { btn.textContent = 'Activate Code Now ✅'; btn.disabled = false; }
                    return;
                }
            }

            if (foundCode.linkedStudentId && String(foundCode.linkedStudentId) !== String(currentUser.id)) {
                if (foundCode.linkedStudentPhone && currentUser.phone && String(foundCode.linkedStudentPhone) !== String(currentUser.phone)) {
                    showToast('⚠️ This code is assigned to a different student number', 'error');
                    if (btn) { btn.textContent = 'Activate Code Now ✅'; btn.disabled = false; }
                    return;
                }
            }

            const nowIso = new Date().toISOString();
            foundCode.used = true;
            foundCode.status = 'used';
            foundCode.usedBy = currentUser.id;
            foundCode.usedByName = currentUser.name || '';
            foundCode.usedByPhone = currentUser.phone || '';
            foundCode.usedAt = nowIso;

            if (db) {
                try {
                    const docId = String(foundCode.id || foundCode.code);
                    await db.collection('codes').doc(docId).set(foundCode, { merge: true });
                } catch (e) {
                    console.warn('[Activation] Could not update code in Firestore:', e.message);
                }
            }

            const allLocalCodes = getCodes();
            const cIdx = allLocalCodes.findIndex(c => (c.code || '').toUpperCase() === code);
            if (cIdx !== -1) {
                allLocalCodes[cIdx] = Object.assign({}, allLocalCodes[cIdx], foundCode);
            } else {
                allLocalCodes.push(foundCode);
            }
            saveCodes(allLocalCodes);

            try {
                const vouchers = JSON.parse(localStorage.getItem('alsaqr_vouchers') || '[]');
                const vIdx = vouchers.findIndex(x => (x.code || '').toUpperCase() === code);
                if (vIdx !== -1) {
                    vouchers[vIdx].status = 'used';
                    vouchers[vIdx].usedAt = nowIso;
                    localStorage.setItem('alsaqr_vouchers', JSON.stringify(vouchers));
                }
            } catch (e) { }

            await enrollStudentInCourse(targetCourseId);

            showToast('🎉 Course activated successfully! Opening first lesson...', 'success');
            if (btn) { btn.textContent = 'Activated Successfully ✅'; }

            launchFirstLesson(targetCourseId);

        } catch (err) {
            console.error('[activateLicenseCode]', err);
            showToast('❌ Error during activation: ' + err.message, 'error');
            if (btn) { btn.textContent = 'Activate Code Now ✅'; btn.disabled = false; }
        }
    };

    // ═══════════════════════════════════════════════════════════
    //  Request Activation via WhatsApp
    // ═══════════════════════════════════════════════════════════
    window.requestActivationWhatsApp = function (courseId, courseTitle, price) {
        var name = (currentUser && currentUser.name) ? currentUser.name : 'Student';
        var phone = (currentUser && currentUser.phone) ? currentUser.phone : '';
        var priceStr = price || 0;
        var titleStr = courseTitle || courseId;

        var message =
            'Hello! 👋\n' +
            'I would like to request an activation code for the following course:\n\n' +
            '📚 Course: ' + titleStr + '\n' +
            '👤 Student Name: ' + name + '\n' +
            (phone ? '📱 Phone: ' + phone + '\n' : '') +
            '💰 Amount: ' + priceStr + ' EGP\n' +
            '📲 Paid via Vodafone Cash: 01220222307\n\n' +
            '(I will attach payment receipt in the next message)';

        var encoded = encodeURIComponent(message);
        var waUrl = 'https://wa.me/201220222307?text=' + encoded;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
    };


    async function enrollStudentInCourse(courseId) {
        const cid = String(courseId);
        if (!currentUser) return;

        if (!Array.isArray(currentUser.enrolledCourses)) currentUser.enrolledCourses = [];
        if (!currentUser.enrolledCourses.some(id => String(id) === cid)) {
            currentUser.enrolledCourses.push(cid);
        }

        saveSession(currentUser);

        // تحديث في iraqiplatform_users
        const users = getUsers();
        const idx = users.findIndex(u => String(u.id) === String(currentUser.id) || (currentUser.phone && u.phone === currentUser.phone));
        if (idx !== -1) {
            if (!Array.isArray(users[idx].enrolledCourses)) users[idx].enrolledCourses = [];
            if (!users[idx].enrolledCourses.some(id => String(id) === cid)) {
                users[idx].enrolledCourses.push(cid);
            }
            saveUsers(users);
        }

        // تحديث في alsaqr_users
        try {
            const dashUsers = JSON.parse(localStorage.getItem('alsaqr_users') || '[]');
            const dIdx = dashUsers.findIndex(u => String(u.id) === String(currentUser.id) || (currentUser.phone && u.phone === currentUser.phone));
            if (dIdx !== -1) {
                if (!Array.isArray(dashUsers[dIdx].enrolledCourses)) dashUsers[dIdx].enrolledCourses = [];
                if (!dashUsers[dIdx].enrolledCourses.some(id => String(id) === cid)) {
                    dashUsers[dIdx].enrolledCourses.push(cid);
                }
                localStorage.setItem('alsaqr_users', JSON.stringify(dashUsers));
            }
        } catch (e) { }

        // تحديث في Firebase Firestore Cloud
        const db = (window.FirebaseService && typeof window.FirebaseService.getDb === 'function')
            ? window.FirebaseService.getDb()
            : (window.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null));

        if (db && currentUser.id) {
            try {
                await db.collection('users').doc(String(currentUser.id)).set({
                    enrolledCourses: firebase.firestore.FieldValue.arrayUnion(cid)
                }, { merge: true });
            } catch (e) {
                console.warn('[Enroll Firebase Sync notice]:', e.message);
            }
        }
    }

    // Helper: الانتقال التلقائي للدرس الأول بعد التفعيل
    async function launchFirstLesson(courseId) {
        // انتظر ثانية واحدة لضمان اكتمال التفعيل في Firebase
        await new Promise(r => setTimeout(r, 1000));

        // حاول مزامنة الدروس من Firebase قبل الانتقال
        try {
            if (window.FirebaseService && typeof window.FirebaseService.lessons === 'object' &&
                typeof window.FirebaseService.lessons.sync === 'function') {
                await window.FirebaseService.lessons.sync();
                // تحديث الـ Bridge بعد المزامنة
                if (typeof window.IRAQI_BRIDGE !== 'undefined' && typeof window.IRAQI_BRIDGE.sync === 'function') {
                    window.IRAQI_BRIDGE.sync();
                }
            }
        } catch (e) {
            console.warn('[launchFirstLesson] lessons sync:', e.message);
        }

        const course = getAllCourses().find(c => String(c.id) === String(courseId));
        if (course) {
            const effectivePackages = sanitizeEffectivePackages(getEffectiveCoursePackages(course));
            const allLessons = effectivePackages.flatMap(p => p.lessons);
            if (allLessons.length > 0 && allLessons[0].id) {
                navigate('lesson/' + courseId + '/' + allLessons[0].id);
                return;
            }
        }
        // fallback: فتح صفحة الكورس مع رسالة واضحة
        navigate('license/' + courseId);
    }

    // Course tab switch
    window.switchCourseTab = function (tab, btn) {
        document.querySelectorAll('.course-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        ['curriculum', 'overview', 'reviews'].forEach(t => {
            const el = document.getElementById('tab-' + t);
            if (el) el.style.display = t === tab ? '' : 'none';
        });
    };

    // ── Smooth Scroll Helper ────────────────────────────────────
    window.scrollToSection = function (sectionId) {
        const el = document.getElementById(sectionId);
        if (el) {
            const headerOffset = 80;
            const elementPosition = el.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    };

    // ── FAQ Accordion Toggle ─────────────────────────────────────
    window.toggleFaq = function (idx) {
        const item = document.getElementById('faq-item-' + idx);
        if (item) {
            item.classList.toggle('open');
        }
    };

    // ── Smooth Scroll To Courses ──────────────────────────────
    window.smoothScrollToCourses = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        scrollToSection('courses-section');
    };

    // ── Home Stage Filter ────────────────────────────────────────
    window.filterHomeStage = function (stageTag, btn) {
        if (currentPage !== 'home') {
            navigate('courses');
            setTimeout(function () {
                const chips = document.querySelectorAll('#filterChips .filter-chip');
                chips.forEach(c => {
                    if (c.dataset.grade === stageTag) {
                        filterByGrade(stageTag, c);
                    }
                });
            }, 100);
            return;
        }

        const chips = document.querySelectorAll('#courses-section .filter-chip');
        chips.forEach(c => {
            if (c.dataset.grade === stageTag || (stageTag === 'الكل' && c.dataset.grade === 'الكل')) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });

        const HOME_GRADE_EQUIV = {
            '1': ['أولى ثانوي'], '2': ['تانية ثانوي'], '2prog': ['تانية ثانوي برمجة'],
            '3': ['تالتة ثانوي'], '1prep': ['أولى إعدادي'], '2prep': ['تانية إعدادي'], '3prep': ['تالتة إعدادي'],
            'أولى ثانوي': ['1'], 'تانية ثانوي': ['2'], 'تانية ثانوي برمجة': ['2prog'],
            'تالتة ثانوي': ['3'], 'أولى إعدادي': ['1prep'], 'تانية إعدادي': ['2prep'], 'تالتة إعدادي': ['3prep'],
            'بكالوريا عام برمجة': ['بكالوريا عام برمجة']
        };
        function homeGradeMatch(cardGrade, filterGrade) {
            if (cardGrade === filterGrade) return true;
            const equiv = HOME_GRADE_EQUIV[filterGrade] || [];
            if (equiv.includes(cardGrade)) return true;
            const rev = HOME_GRADE_EQUIV[cardGrade] || [];
            if (rev.includes(filterGrade)) return true;
            return false;
        }
        const cards = document.querySelectorAll('#homeCoursesGrid .course-card');
        let visibleCount = 0;
        cards.forEach(card => {
            const cardGrade = card.dataset.grade || '';
            const isFreeCard = card.dataset.free === 'true';
            let match = false;
            if (stageTag === 'الكل') {
                match = true;
            } else if (stageTag === 'مجاني') {
                match = isFreeCard || cardGrade === 'مجاني';
            } else {
                match = homeGradeMatch(cardGrade, stageTag);
            }
            card.style.display = match ? '' : 'none';
            if (match) visibleCount++;
        });

        const empty = document.getElementById('homeCoursesEmpty');
        if (empty) empty.style.display = visibleCount === 0 ? '' : 'none';

        scrollToSection('courses-section');
    };

    // ── Home Courses Search ──────────────────────────────────────
    window.handleHomeSearch = function (query) {
        const q = (query || '').toLowerCase().trim();
        const activeChip = document.querySelector('#courses-section .filter-chip.active');
        const activeGrade = activeChip ? activeChip.dataset.grade : 'الكل';

        const cards = document.querySelectorAll('#homeCoursesGrid .course-card');
        let visibleCount = 0;
        cards.forEach(card => {
            const cardGrade = card.dataset.grade || '';
            const isFreeCard = card.dataset.free === 'true';
            const text = card.textContent.toLowerCase();
            let matchGrade = false;
            if (activeGrade === 'الكل') {
                matchGrade = true;
            } else if (activeGrade === 'مجاني') {
                matchGrade = isFreeCard || cardGrade === 'مجاني';
            } else if (activeGrade === 'أولى إعدادي') {
                matchGrade = cardGrade === 'أولى إعدادي' || cardGrade === '1prep' || cardGrade.includes('الأول الإعدادي');
            } else if (activeGrade === 'تانية إعدادي') {
                matchGrade = cardGrade === 'تانية إعدادي' || cardGrade === '2prep' || cardGrade.includes('الثاني الإعدادي');
            } else if (activeGrade === 'تالتة إعدادي') {
                matchGrade = cardGrade === 'تالتة إعدادي' || cardGrade === '3prep' || cardGrade.includes('الثالث الإعدادي');
            } else if (activeGrade === 'أولى ثانوي') {
                matchGrade = cardGrade === 'أولى ثانوي' || cardGrade === '1' || cardGrade.includes('الأول الثانوي');
            } else if (activeGrade === 'تانية ثانوي') {
                matchGrade = cardGrade === 'تانية ثانوي' || cardGrade === '2' || cardGrade.includes('الثاني الثانوي');
            } else if (activeGrade === 'تالتة ثانوي') {
                matchGrade = cardGrade === 'تالتة ثانوي' || cardGrade === '3' || cardGrade.includes('الثالث الثانوي');
            } else {
                matchGrade = cardGrade === activeGrade;
            }
            const matchSearch = !q || text.includes(q);
            const show = matchGrade && matchSearch;
            card.style.display = show ? '' : 'none';
            if (show) visibleCount++;
        });

        const empty = document.getElementById('homeCoursesEmpty');
        if (empty) empty.style.display = visibleCount === 0 ? '' : 'none';
    };

    // Course filtering (Courses Page)
    window.filterByGrade = function (grade, chip) {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        if (chip) chip.classList.add('active');
        filterCourses();
    };
    window.filterCourses = function () {
        const search = (document.getElementById('courseSearchInput') ? document.getElementById('courseSearchInput').value : '').toLowerCase();
        const activeChip = document.querySelector('#filterChips .filter-chip.active');
        const grade = activeChip ? activeChip.dataset.grade : 'الكل';

        const cards = document.querySelectorAll('#coursesGrid .course-card');
        let visible = 0;
        // خريطة تحويل: قيم Firebase الرقمية ↔ قيم gradeTag العربية
        const GRADE_EQUIV = {
            '1': ['أولى ثانوي', 'الأول الثانوي'],
            '2': ['تانية ثانوي', 'الثاني الثانوي'],
            '2prog': ['تانية ثانوي برمجة'],
            '3': ['تالتة ثانوي', 'الثالث الثانوي'],
            '1prep': ['أولى إعدادي', 'الأول الإعدادي'],
            '2prep': ['تانية إعدادي', 'الثاني الإعدادي'],
            '3prep': ['تالتة إعدادي', 'الثالث الإعدادي'],
            'أولى ثانوي': ['1'], 'تانية ثانوي': ['2'], 'تانية ثانوي برمجة': ['2prog'],
            'تالتة ثانوي': ['3'], 'أولى إعدادي': ['1prep'],
            'تانية إعدادي': ['2prep'], 'تالتة إعدادي': ['3prep'],
            'بكالوريا عام برمجة': ['بكالوريا عام برمجة']
        };
        function gradeMatch(cardGrade, filterGrade) {
            if (!filterGrade || filterGrade === 'الكل') return true;
            if (cardGrade === filterGrade) return true;
            const equiv = GRADE_EQUIV[filterGrade] || [];
            if (equiv.includes(cardGrade)) return true;
            const revEquiv = GRADE_EQUIV[cardGrade] || [];
            if (revEquiv.includes(filterGrade)) return true;
            return false;
        }
        cards.forEach(card => {
            const cardGrade = card.dataset.grade || '';
            const isFreeCard = card.dataset.free === 'true';
            const text = card.textContent.toLowerCase();
            let matchGrade;
            if (grade === 'الكل') {
                matchGrade = true;
            } else if (grade === 'مجاني') {
                matchGrade = isFreeCard;
            } else {
                matchGrade = gradeMatch(cardGrade, grade);
            }
            const matchSearch = !search || text.includes(search);
            const show = matchGrade && matchSearch;
            card.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        const empty = document.getElementById('coursesEmpty');
        if (empty) empty.style.display = visible === 0 ? '' : 'none';
    };

    // Quiz
    let quizAnswers = {};
    window.selectQuizOption = function (qi, oi) {
        quizAnswers[qi] = oi;
        document.querySelectorAll('.quiz-option[data-q="' + qi + '"]').forEach(opt => {
            opt.classList.toggle('selected', parseInt(opt.dataset.o) === oi);
        });
    };
    window.submitQuiz = function () {
        let correct = 0;
        QUIZ_DATA.questions.forEach((q, qi) => {
            const options = document.querySelectorAll('.quiz-option[data-q="' + qi + '"]');
            options.forEach(opt => {
                const oi = parseInt(opt.dataset.o);
                if (oi === q.correct) {
                    opt.classList.add('correct');
                } else if (quizAnswers[qi] === oi) {
                    opt.classList.add('wrong');
                }
                opt.style.pointerEvents = 'none';
            });
            if (quizAnswers[qi] === q.correct) correct++;
        });
        const pct = Math.round((correct / QUIZ_DATA.questions.length) * 100);
        showToast('Score: ' + correct + '/' + QUIZ_DATA.questions.length + ' (' + pct + '%) ' + (pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'), pct >= 50 ? 'success' : 'error');
    };

    // Password toggle
    window.togglePassword = function (inputId, toggle) {
        const input = document.getElementById(inputId);
        if (input) {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggle.textContent = isPassword ? '🙈' : '👁️';
        }
    };

    // Password strength indicator (min 6 chars)
    window.checkPasswordStrength = function (val) {
        const bar = document.getElementById('passwordStrengthBar');
        const fill = document.getElementById('passwordStrengthFill');
        const text = document.getElementById('passwordStrengthText');
        if (!bar) return;

        if (!val) { bar.style.display = 'none'; return; }
        bar.style.display = '';

        const len = val.length;
        const hasValidChars = /^[a-zA-Z0-9]+$/.test(val);

        if (!hasValidChars) {
            fill.style.width = '100%';
            fill.style.background = '#ef4444';
            text.textContent = '❌ Only English letters and numbers are allowed';
            text.style.color = '#ef4444';
        } else if (len < 6) {
            fill.style.width = (len / 6 * 100) + '%';
            fill.style.background = '#f59e0b';
            text.textContent = len + '/6 characters — enter at least ' + (6 - len) + ' more character(s)';
            text.style.color = '#f59e0b';
        } else if (len < 10) {
            fill.style.width = '70%';
            fill.style.background = '#10b981';
            text.textContent = '✅ Good password (' + len + ' characters)';
            text.style.color = '#10b981';
        } else {
            fill.style.width = '100%';
            fill.style.background = '#0ea5e9';
            text.textContent = '💪 Strong password (' + len + ' characters)';
            text.style.color = '#0ea5e9';
        }
    };

    // ── Grade change handler: show section options for 2nd Secondary ────
    window.handleGradeChange = function (val) {
        const sg = document.getElementById('sectionGroup');
        if (!sg) return;
        if (val === '2nd Year Secondary' || val === 'ثانية ثانوي') {
            sg.style.display = '';
            document.querySelectorAll('input[name="registerSection"]').forEach(r => r.checked = false);
        } else {
            sg.style.display = 'none';
            document.querySelectorAll('input[name="registerSection"]').forEach(r => r.checked = false);
        }
    };

    // ── Live Phone Number Input Sanitizer & 11-Digit Counter ────
    window.handlePhoneInputLive = function (input, counterId) {
        if (!input) return;
        var cleaned = (input.value || '').replace(/[^0-9]/g, '').slice(0, 11);
        input.value = cleaned;

        var counter = document.getElementById(counterId);
        if (counter) {
            counter.textContent = cleaned.length + ' / 11 digits';
            if (cleaned.length === 11 && cleaned.startsWith('01')) {
                counter.className = 'phone-len-counter valid';
                input.classList.remove('input-error');
                input.classList.add('input-valid');
            } else if (cleaned.length > 0) {
                counter.className = 'phone-len-counter typing';
                input.classList.remove('input-valid');
                input.classList.remove('input-error');
            } else {
                counter.className = 'phone-len-counter';
                input.classList.remove('input-valid', 'input-error');
            }
        }
    };

    // ── Auth Handlers ────────────────────────────────────────────
    window.handleLogin = async function () {
        const phoneInput = document.getElementById('loginPhone');
        let phone = phoneInput ? phoneInput.value.trim().replace(/[^0-9]/g, '') : '';
        const password = document.getElementById('loginPassword') ? document.getElementById('loginPassword').value : '';
        const errorMsg = document.getElementById('loginErrorMsg');
        const loginBtn = document.getElementById('loginSubmitBtn');

        function showError(msg) {
            if (errorMsg) {
                errorMsg.innerHTML = '<span class="alert-icon">⚠️</span> ' + msg;
                errorMsg.style.display = '';
            }
        }
        function hideError() { if (errorMsg) errorMsg.style.display = 'none'; }

        hideError();

        if (!phone || !password) {
            showError('Please enter both student phone number and password.');
            return;
        }

        if (phone.length !== 11 || !phone.startsWith('01')) {
            showError('Phone number must be exactly 11 digits starting with 01 (e.g. 01012345678). You entered ' + phone.length + ' digits.');
            if (phoneInput) { phoneInput.classList.add('input-error'); phoneInput.focus(); }
            return;
        }

        // ── خطوة 1: هل الحساب موجود؟ (قاعدة البيانات هي المرجع الأساسي) ──
        var _loginBtnOriginalHtml = loginBtn ? loginBtn.innerHTML : '';
        if (loginBtn) { loginBtn.disabled = true; loginBtn.innerHTML = '<span>Verifying…</span>'; }
        let account;
        try {
            account = await findAccountByPhone(phone);
        } finally {
            if (loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = _loginBtnOriginalHtml; }
        }

        if (!account) {
            showError('This phone number is not registered. Please create an account first.');
            return;
        }

        // ── خطوة 2: هل كلمة المرور صحيحة؟ (منفصلة تمامًا عن خطوة وجود الحساب) ──
        if (!verifyAccountPassword(account, password)) {
            showError('Incorrect password. Please try again.');
            return;
        }

        // ── خطوة 3: إنشاء جلسة الدخول ──────────────────────────────────
        saveSession(account);
        refreshLayout();
        showToast('Welcome back, ' + account.name + '! Signed in successfully 🎉', 'success');
        const redirect = sessionStorage.getItem('iraqiplatform_redirect');
        if (redirect) {
            sessionStorage.removeItem('iraqiplatform_redirect');
            navigate(redirect);
        } else {
            navigate('profile');
        }
    };

    window.handleRegister = async function () {
        const fullName = document.getElementById('registerFullName') ? document.getElementById('registerFullName').value.trim() : '';
        const phoneInput = document.getElementById('registerPhone');
        const parentPhoneInput = document.getElementById('registerParentPhone');
        let phone = phoneInput ? phoneInput.value.trim().replace(/[^0-9]/g, '') : '';
        let parentPhone = parentPhoneInput ? parentPhoneInput.value.trim().replace(/[^0-9]/g, '') : '';
        const grade = document.getElementById('registerGrade') ? document.getElementById('registerGrade').value : '';
        const sectionRadio = document.querySelector('input[name="registerSection"]:checked');
        const section = sectionRadio ? sectionRadio.value : '';
        const governorate = document.getElementById('registerGovernorate') ? document.getElementById('registerGovernorate').value : '';
        const password = document.getElementById('registerPassword') ? document.getElementById('registerPassword').value : '';
        const confirmPassword = document.getElementById('registerConfirmPassword') ? document.getElementById('registerConfirmPassword').value : '';
        const errorMsg = document.getElementById('registerErrorMsg');

        function showError(msg) {
            if (errorMsg) {
                errorMsg.innerHTML = '<span class="alert-icon">⚠️</span> ' + msg;
                errorMsg.style.display = '';
            }
        }
        function hideError() { if (errorMsg) errorMsg.style.display = 'none'; }

        hideError();

        if (!fullName || !phone || !parentPhone || !grade || !governorate || !password || !confirmPassword) {
            showError('Please fill in all required fields to create your account.');
            return;
        }

        if (phone.length !== 11 || !phone.startsWith('01')) {
            showError('Student phone number must be exactly 11 digits starting with 01 (e.g. 01012345678).');
            if (phoneInput) { phoneInput.classList.add('input-error'); phoneInput.focus(); }
            return;
        }

        if (parentPhone.length !== 11 || !parentPhone.startsWith('01')) {
            showError('Parent phone number must be exactly 11 digits starting with 01 (e.g. 01123456789).');
            if (parentPhoneInput) { parentPhoneInput.classList.add('input-error'); parentPhoneInput.focus(); }
            return;
        }

        if (phone === parentPhone) {
            showError('Student phone and parent phone cannot be the same. Please provide two different numbers.');
            if (parentPhoneInput) { parentPhoneInput.classList.add('input-error'); parentPhoneInput.focus(); }
            return;
        }

        if ((grade === '2nd Year Secondary' || grade === 'ثانية ثانوي') && !section) {
            showError('Please select your academic section (General or Baccalaureate).');
            return;
        }

        if (!validatePassword(password)) {
            showError('Password must be at least 6 characters (English letters and numbers only).');
            return;
        }

        if (password !== confirmPassword) {
            showError('Password and confirmation password do not match.');
            return;
        }

        // ── نفس دالة التحقق المستخدمة في تسجيل الدخول بالظبط — قاعدة
        //    البيانات هي المرجع، عشان طالب ما يقدرش يعمل حساب مكرر لو
        //    رقمه مسجّل بالفعل من جهاز تاني ────────────────────────────
        const existingPhone = await findAccountByPhone(phone);

        if (existingPhone) {
            showError('This student phone number is already registered. Please sign in instead.');
            return;
        }

        const users = getUsers();
        const gradeLabel = (grade === '2nd Year Secondary' || grade === 'ثانية ثانوي') && section ? grade + ' — ' + section : grade;
        const newUser = {
            id: 'user_' + Date.now(),
            name: fullName,
            email: '',
            phone: phone,
            parentPhone: parentPhone,
            grade: gradeLabel,
            section: section || '',
            governorate: governorate,
            password: password,
            enrolledCourses: [],
            completedLessons: 0,
            avgScore: 0,
            streak: 1,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsers(users);
        saveSession(newUser);
        refreshLayout();
        showToast('Welcome, ' + fullName + '! Account created successfully 🎉', 'success');
        const regRedirect = sessionStorage.getItem('iraqiplatform_redirect');
        if (regRedirect) {
            sessionStorage.removeItem('iraqiplatform_redirect');
            navigate(regRedirect);
        } else {
            navigate('profile');
        }
    };

    window.handleLogout = function () {
        clearSession();
        refreshLayout();
        navigate('home');
        showToast('Signed out successfully');
    };

    // Profile save
    window.saveProfileChanges = function () {
        if (!currentUser) return;
        const name = document.getElementById('profileName') ? document.getElementById('profileName').value.trim() : '';
        const phone = document.getElementById('profilePhone') ? document.getElementById('profilePhone').value.trim().replace(/[^0-9]/g, '') : '';
        const parentPhone = document.getElementById('profileParentPhone') ? document.getElementById('profileParentPhone').value.trim().replace(/[^0-9]/g, '') : '';
        const grade = document.getElementById('profileGrade') ? document.getElementById('profileGrade').value : '';
        const governorate = document.getElementById('profileGovernorate') ? document.getElementById('profileGovernorate').value : '';
        if (!name) { showToast('Please enter your full name', 'error'); return; }
        if (phone && (phone.length !== 11 || !phone.startsWith('01'))) {
            showToast('Student phone must be 11 digits starting with 01', 'error');
            return;
        }
        if (parentPhone && (parentPhone.length !== 11 || !parentPhone.startsWith('01'))) {
            showToast('Parent phone must be 11 digits starting with 01', 'error');
            return;
        }
        currentUser.name = name;
        currentUser.phone = phone;
        currentUser.parentPhone = parentPhone;
        currentUser.grade = grade;
        currentUser.governorate = governorate;
        saveSession(currentUser);
        const users = getUsers();
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) { users[idx] = currentUser; saveUsers(users); }
        showToast('Profile updated successfully! ✅', 'success');
        refreshLayout();
    };

    // Password change
    window.changePassword = function () {
        if (!currentUser) return;
        const current = document.getElementById('currentPasswordInput') ? document.getElementById('currentPasswordInput').value : '';
        const newPw = document.getElementById('newPasswordInput') ? document.getElementById('newPasswordInput').value : '';
        const confirm = document.getElementById('confirmPasswordInput') ? document.getElementById('confirmPasswordInput').value : '';
        if (current !== currentUser.password) { showToast('Current password is incorrect', 'error'); return; }
        if (!validatePassword(newPw)) { showToast('New password must be at least 6 alphanumeric characters', 'error'); return; }
        if (newPw !== confirm) { showToast('New password and confirmation do not match', 'error'); return; }
        currentUser.password = newPw;
        saveSession(currentUser);
        const users = getUsers();
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) { users[idx] = currentUser; saveUsers(users); }
        showToast('Password changed successfully! 🔒', 'success');
    };

    // Navigate helper
    window.navigate = navigate;

    // Toast notification
    window.showToast = function (message, type) {
        let toast = document.getElementById('app-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = 'toast ' + (type || '');
        requestAnimationFrame(function () {
            toast.classList.add('show');
        });
        setTimeout(function () {
            toast.classList.remove('show');
        }, 3500);
    };


    // ═══════════════════════════════════════════════════════════
    // SCROLL ANIMATIONS
    // ═══════════════════════════════════════════════════════════
    function initScrollReveal() {
        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
    }

    // ═══════════════════════════════════════════════════════════
    // ANIMATED COUNTERS
    // ═══════════════════════════════════════════════════════════
    function initHomeAnimations() {
        const counters = document.querySelectorAll('[data-count]');
        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(function (el) { observer.observe(el); });

        // تشغيل الكتابة الحية للعنوان في البنر
        if (typeof window.startHeroTypewriter === 'function') {
            window.startHeroTypewriter();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // HERO HEADING SHIMMER & ENTRANCE
    // ═══════════════════════════════════════════════════════════════
    window.startHeroTypewriter = function () {
        var heading = document.getElementById('heroDynamicHeading');
        if (heading) {
            heading.classList.add('hero-heading-active');
        }
    };

    function animateCounter(el) {
        const target = parseInt(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const duration = 2000;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = Math.round(eased * target);
            el.textContent = current.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }


    // ═══════════════════════════════════════════════════════════
    // HEADER SCROLL EFFECT
    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    // THEME SYSTEM — Light / Dark Mode
    // ═══════════════════════════════════════════════════════════
    var THEME_KEY = 'iraqiplatform_theme';

    function getCurrentTheme() {
        return localStorage.getItem(THEME_KEY) || 'light';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    }

    function initTheme() {
        var saved = getCurrentTheme();
        applyTheme(saved);
    }

    window.toggleTheme = function () {
        var current = document.documentElement.getAttribute('data-theme') || 'light';
        var next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    };

    // Apply theme immediately (before any render) to prevent flash
    initTheme();

    function initHeaderScroll() {
        const header = document.getElementById('main-header');
        if (!header) return;

        window.addEventListener('scroll', function () {
            const scrollY = window.scrollY;
            header.classList.toggle('scrolled', scrollY > 50);
        }, { passive: true });
    }


    // ═══════════════════════════════════════════════════════════
    // PAGE INIT HELPERS
    // ═══════════════════════════════════════════════════════════
    function initCoursesPage() { }
    function initCourseDetailsPage() { }
    function initLessonPage() {
        quizAnswers = {};
        // إذا كانت صفحة الدرس تعرض "لا توجد دروس" → حاول تحديث من Firebase
        setTimeout(async function () {
            const noLessonMsg = document.querySelector('.lesson-content .video-placeholder, .lesson-content [style*="لا توجد"]');
            if (!noLessonMsg) return;
            try {
                if (window.FirebaseService && typeof window.FirebaseService.lessons === 'object') {
                    await window.FirebaseService.lessons.sync();
                    if (typeof window.IRAQI_BRIDGE !== 'undefined' && typeof window.IRAQI_BRIDGE.sync === 'function') {
                        window.IRAQI_BRIDGE.sync();
                    }
                    // إعادة رسم الصفحة الحالية
                    const hash = window.location.hash.slice(1) || 'home';
                    const [page, ...params] = hash.split('/');
                    if (page === 'lesson') {
                        const content = document.getElementById('app-content');
                        if (content) content.innerHTML = renderLessonPage(params[0], params[1]);
                    }
                }
            } catch (e) { console.warn('[initLessonPage] auto-refresh:', e.message); }
        }, 1500);
    }
    function initLicensePage() {
        // ── تأكيد حي من Firebase إن حالة تفعيل الكورسات محدّثة، بدل ما
        //    نعتمد بس على النسخة المخزّنة في جلسة تسجيل الدخول الحالية —
        //    وده اللي بيحل مشكلة "يطلب كود تفعيل تاني" لو الطالب فعّل
        //    الكورس من جهاز/متصفح مختلف. Firebase هو المرجع الحقيقي دايمًا.
        if (!window.db || !currentUser || !currentUser.id) return;
        window.db.collection('users').doc(String(currentUser.id)).get().then(function (doc) {
            if (!doc.exists) return;
            var remote = doc.data() || {};
            var remoteCourses = Array.isArray(remote.enrolledCourses) ? remote.enrolledCourses.map(String) : [];
            var localCourses = Array.isArray(currentUser.enrolledCourses) ? currentUser.enrolledCourses.map(String) : [];
            var hasNew = remoteCourses.some(function (id) { return localCourses.indexOf(id) === -1; });
            if (hasNew) {
                currentUser.enrolledCourses = remoteCourses;
                saveSession(currentUser);
                if (typeof window.handleRoute === 'function') window.handleRoute();
            }
        }).catch(function (e) {
            console.warn('[License] Firebase enrollment check failed:', e.message);
        });
    }

    function initAdminCoursePage() {
        // لا شيء إضافي حالياً — الـ drag & drop مستقبلي
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN — LESSON MODAL
    // ═══════════════════════════════════════════════════════════

    // متغيرات الـ Admin State
    let _adminCurrentCourseId = null;
    let _adminSelectedContentType = 'video';

    window.openLessonModal = function (lessonId, courseId) {
        _adminCurrentCourseId = courseId;
        const overlay = document.getElementById('lessonModalOverlay');
        const title = document.getElementById('lessonModalTitle');
        const idInput = document.getElementById('lessonModalId');
        const nameInput = document.getElementById('lessonModalName');
        const descInput = document.getElementById('lessonModalDesc');
        const orderInput = document.getElementById('lessonModalOrder');
        const statusSelect = document.getElementById('lessonModalStatus');
        if (!overlay) return;

        if (lessonId) {
            // وضع التعديل
            const lessons = getLessons();
            const lesson = lessons.find(l => l.lessonId === lessonId);
            if (!lesson) return;
            title.textContent = '✏️ تعديل الدرس';
            idInput.value = lesson.lessonId;
            nameInput.value = lesson.title;
            descInput.value = lesson.description || '';
            orderInput.value = lesson.order || 1;
            statusSelect.value = lesson.status || 'published';
        } else {
            // Creation mode
            const courseLessons = getCourseLessons(courseId);
            title.textContent = '➕ Add New Lesson';
            idInput.value = '';
            nameInput.value = '';
            descInput.value = '';
            orderInput.value = courseLessons.length + 1;
            statusSelect.value = 'published';
        }

        overlay.classList.add('show');
        setTimeout(() => { if (nameInput) nameInput.focus(); }, 300);
    };

    window.closeLessonModal = function () {
        const overlay = document.getElementById('lessonModalOverlay');
        if (overlay) overlay.classList.remove('show');
    };

    window.saveLessonModal = function () {
        const lessonId = document.getElementById('lessonModalId').value;
        const courseId = document.getElementById('lessonModalCourseId').value;
        const title = (document.getElementById('lessonModalName').value || '').trim();
        const description = (document.getElementById('lessonModalDesc').value || '').trim();
        const order = parseInt(document.getElementById('lessonModalOrder').value) || 1;
        const status = document.getElementById('lessonModalStatus').value;

        if (!title) { showToast('Please enter a lesson title', 'error'); return; }

        if (lessonId) {
            updateLesson(lessonId, { title, description, order, status });
            showToast('✅ Lesson updated successfully', 'success');
        } else {
            createLesson(courseId, { title, description, order, status });
            showToast('✅ Lesson created successfully', 'success');
        }

        closeLessonModal();
        navigate('admin-course/' + courseId);
    };

    // ═══════════════════════════════════════════════════════════
    // ADMIN — CONTENT MODAL
    // ═══════════════════════════════════════════════════════════

    window.openContentModal = function (lessonId, contentId) {
        const overlay = document.getElementById('contentModalOverlay');
        const title = document.getElementById('contentModalTitle');
        const idInput = document.getElementById('contentModalId');
        const lessonIdInput = document.getElementById('contentModalLessonId');
        const nameInput = document.getElementById('contentModalName');
        const contentInput = document.getElementById('contentModalContent');
        const durationInput = document.getElementById('contentModalDuration');
        if (!overlay) return;

        lessonIdInput.value = lessonId;

        if (contentId) {
            // Edit mode
            const content = getContents().find(c => c.contentId === contentId);
            if (!content) return;
            title.textContent = '✏️ Edit Content';
            idInput.value = content.contentId;
            nameInput.value = content.title;
            contentInput.value = content.content || '';
            durationInput.value = content.duration || '';
            selectContentType(content.type);
        } else {
            // Creation mode
            title.textContent = '➕ Add New Content';
            idInput.value = '';
            nameInput.value = '';
            contentInput.value = '';
            durationInput.value = '';
            selectContentType('video');
        }

        overlay.classList.add('show');
        setTimeout(() => { if (nameInput) nameInput.focus(); }, 300);
    };

    window.closeContentModal = function () {
        const overlay = document.getElementById('contentModalOverlay');
        if (overlay) overlay.classList.remove('show');
    };

    window.selectContentType = function (type) {
        _adminSelectedContentType = type;
        document.querySelectorAll('.content-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        const contentInput = document.getElementById('contentModalContent');
        if (contentInput) {
            const placeholders = {
                video: 'Video URL (YouTube, Vimeo, Bunny, ...)',
                pdf: 'PDF file or Google Drive URL',
                quiz: 'Quiz identifier or URL',
                text: 'Write notes or lecture text here...'
            };
            contentInput.placeholder = placeholders[type] || 'Content link...';
        }
    };

    window.saveContentModal = function () {
        const contentId = document.getElementById('contentModalId').value;
        const lessonId = document.getElementById('contentModalLessonId').value;
        const title = (document.getElementById('contentModalName').value || '').trim();
        const content = (document.getElementById('contentModalContent').value || '').trim();
        const duration = (document.getElementById('contentModalDuration').value || '').trim();
        const type = _adminSelectedContentType;

        if (!title) { showToast('Please enter a content title', 'error'); return; }

        const lesson = getLessons().find(l => l.lessonId === lessonId);
        const courseId = lesson ? lesson.courseId : _adminCurrentCourseId;

        if (contentId) {
            updateContent(contentId, { title, content, duration, type });
            showToast('✅ Content updated successfully', 'success');
        } else {
            createContent(lessonId, { title, content, duration, type });
            showToast('✅ Content added successfully', 'success');
        }

        closeContentModal();
        if (courseId) navigate('admin-course/' + courseId);
    };

    // ═══════════════════════════════════════════════════════════
    // ADMIN — LESSON BOX TOGGLE
    // ═══════════════════════════════════════════════════════════

    window.toggleLessonBox = function (lessonId) {
        const box = document.getElementById('lesson-box-' + lessonId);
        const body = document.getElementById('lesson-box-body-' + lessonId);
        const icon = document.getElementById('toggle-icon-' + lessonId);
        if (!box || !body) return;
        const isOpen = box.classList.contains('open');
        box.classList.toggle('open', !isOpen);
        if (icon) icon.textContent = !isOpen ? '▼' : '▶';
    };

    // ═══════════════════════════════════════════════════════════
    // ADMIN — DELETE CONFIRM MODAL
    // ═══════════════════════════════════════════════════════════

    let _deleteCallback = null;

    function openDeleteModal(message, callback) {
        const overlay = document.getElementById('deleteModalOverlay');
        const msg = document.getElementById('deleteModalMsg');
        const btn = document.getElementById('deleteModalConfirmBtn');
        if (!overlay) return;
        if (msg) msg.textContent = message;
        _deleteCallback = callback;
        btn.onclick = function () {
            if (_deleteCallback) _deleteCallback();
            closeDeleteModal();
        };
        overlay.classList.add('show');
    }

    window.closeDeleteModal = function () {
        const overlay = document.getElementById('deleteModalOverlay');
        if (overlay) overlay.classList.remove('show');
        _deleteCallback = null;
    };

    window.confirmDeleteLesson = function (lessonId, courseId) {
        const lesson = getLessons().find(l => l.lessonId === lessonId);
        const name = lesson ? lesson.title : 'this lesson';
        const contentCount = getLessonContents(lessonId).length;
        const msg = `Are you sure you want to delete "${name}"?${contentCount > 0 ? ` ${contentCount} content items will also be removed.` : ''}`;
        openDeleteModal(msg, function () {
            deleteLesson(lessonId);
            showToast('🗑 Lesson deleted successfully', 'success');
            navigate('admin-course/' + courseId);
        });
    };

    window.confirmDeleteContent = function (contentId, courseId) {
        const content = getContents().find(c => c.contentId === contentId);
        const name = content ? content.title : 'this content item';
        openDeleteModal(`Are you sure you want to delete "${name}"?`, function () {
            const lessonId = content ? content.lessonId : null;
            const lesson = lessonId ? getLessons().find(l => l.lessonId === lessonId) : null;
            const cId = courseId || (lesson ? lesson.courseId : null);
            deleteContent(contentId);
            showToast('🗑 Content deleted successfully', 'success');
            if (cId) navigate('admin-course/' + cId);
        });
    };

    function initAuthPage() {
        setTimeout(function () {
            const firstInput = document.querySelector('.auth-form .form-input');
            if (firstInput) firstInput.focus();
        }, 600);
    }


    // ═══════════════════════════════════════════════════════════
    // LAYOUT REFRESH
    // ═══════════════════════════════════════════════════════════
    function refreshLayout() {
        // Build new header HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderHeader();

        // Replace old header
        const oldHeader = document.getElementById('main-header');
        const newHeader = tempDiv.querySelector('#main-header');
        if (oldHeader && newHeader) oldHeader.replaceWith(newHeader);

        // Remove old mobile overlays
        const oldOverlay = document.getElementById('mobileOverlay');
        const oldMenu = document.getElementById('mobileMenu');
        if (oldOverlay) oldOverlay.remove();
        if (oldMenu) oldMenu.remove();

        // Append new overlays (they come after the header in the template)
        const newOverlay = tempDiv.querySelector('#mobileOverlay');
        const newMenu = tempDiv.querySelector('#mobileMenu');
        if (newOverlay) document.body.insertBefore(newOverlay, document.body.children[1] || null);
        if (newMenu) document.body.insertBefore(newMenu, document.body.children[2] || null);

        const footer = document.getElementById('main-footer');
        if (footer) footer.innerHTML = renderFooter();
        initHeaderScroll();
        updateActiveNav();
    }


    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════
    function init() {
        // Apply theme first (prevents flash of wrong theme)
        initTheme();

        // Load session from localStorage first
        loadSession();

        // تأكيد صلاحية الجلسة المستعادة من قاعدة البيانات في الخلفية —
        // بدون تأخير عرض الواجهة (نفس التوقيت اللي كان مستخدم أصلاً
        // لمزامنة الأكواد تحت)
        setTimeout(function () {
            verifySessionInBackground();
        }, 1500);

        // Sync codes from Firebase
        setTimeout(function () {
            syncCodesFromFirebase().catch(function (e) {
                console.warn('[init] syncCodesFromFirebase:', e.message);
            });
        }, 2000);

        // Bootstrap admin account if it doesn't exist yet
        const users = getUsers();
        const adminExists = users.find(u => u.email === ADMIN_EMAIL);
        if (!adminExists) {
            users.push({
                id: 'admin_builtin',
                name: 'Mr. Islam Abdelwahed',
                email: ADMIN_EMAIL,
                phone: '01000000000',
                grade: 'Admin',
                password: ADMIN_PASSWORD,
                enrolledCourses: [],
                completedLessons: 0,
                avgScore: 0,
                streak: 1,
                createdAt: new Date().toISOString(),
            });
            saveUsers(users);
        }

        // Render layout into #app container
        const appContainer = document.getElementById('app');
        const layoutHTML =
            renderHeader() +
            '<main id="app-content"></main>' +
            '<footer class="footer" id="main-footer">' + renderFooter() + '</footer>' +
            '<div id="modal-container"></div>';

        if (appContainer) {
            appContainer.innerHTML = layoutHTML;
        } else {
            document.body.innerHTML = layoutHTML;
        }

        initHeaderScroll();
        initRouter();
    }

    // ═══════════════════════════════════════════════════════════
    // GUARDS
    // ═══════════════════════════════════════════════════════════

    /**
     * openCourse
     */
    window.openCourse = function (courseId) {
        if (!isLoggedIn) {
            sessionStorage.setItem('iraqiplatform_redirect', 'license/' + courseId);
            showToast('Please sign in first to access this course', 'error');
            navigate('login');
            return;
        }
        var course = getAllCourses().find(function (c) { return String(c.id) === String(courseId); });
        var isEnrolled = course && (currentUser.enrolledCourses || []).some(function (id) {
            return String(id) === String(courseId);
        });

        if (course && (course.isFree || isEnrolled)) {
            var effectivePackages = sanitizeEffectivePackages(getEffectiveCoursePackages(course));
            var allLessons = effectivePackages.flatMap(function (p) { return p.lessons; });
            if (allLessons.length > 0 && allLessons[0].id) {
                navigate('lesson/' + courseId + '/' + allLessons[0].id);
                return;
            }
        }

        navigate('license/' + courseId);
    };

    /**
     * openLesson
     */
    window.openLesson = function (courseId, lessonId) {
        if (!isLoggedIn) {
            sessionStorage.setItem('iraqiplatform_redirect', 'lesson/' + courseId + '/' + lessonId);
            showToast('Please sign in first to access this lesson', 'error');
            navigate('login');
            return;
        }
        var course = getAllCourses().find(function (c) { return String(c.id) === String(courseId); });
        var isEnrolled = course && (currentUser.enrolledCourses || []).some(function (id) {
            return String(id) === String(courseId);
        });
        if (!course || (!course.isFree && !isEnrolled)) {
            showToast('This course requires activation first', 'error');
            navigate('license/' + courseId);
            return;
        }
        navigate('lesson/' + courseId + '/' + lessonId);
    };

    // ═══════════════════════════════════════════════════════════
    // AUTH REQUIRED PAGE
    // ═══════════════════════════════════════════════════════════
    function renderAuthRequiredPage(courseId) {
        var course = getAllCourses().find(function (c) { return String(c.id) === String(courseId); });
        var courseTitle = course ? course.title : 'Selected Course';
        return '<div style="padding-top:calc(var(--header-height) + var(--space-3xl));padding-bottom:var(--space-3xl);min-height:80vh;display:flex;align-items:center;">' +
            '<div class="container">' +
            '<div class="reveal" style="max-width:520px;margin:0 auto;text-align:center;background:var(--bg-surface,#fff);border-radius:24px;padding:56px 40px;box-shadow:0 24px 64px rgba(0,0,0,.10);border:1px solid var(--border);">' +
            '<div style="font-size:64px;margin-bottom:20px;">🔐</div>' +
            '<h2 style="font-size:1.6rem;font-weight:900;margin-bottom:12px;">Sign In Required</h2>' +
            '<div style="background:linear-gradient(135deg,#FFF7ED,#FFEDD5);border:1px solid #67E8F9;border-radius:14px;padding:16px 20px;margin-bottom:28px;">' +
            '<p style="margin:0;color:#0E7490;font-size:0.95rem;font-weight:600;">To access course: <span style="color:#0f172a;">' + courseTitle + '</span></p>' +
            '</div>' +
            '<p style="color:var(--text-secondary);font-size:0.95rem;margin-bottom:32px;line-height:1.8;">Please sign in or create a free account to continue to your selected course.</p>' +
            '<div style="display:flex;flex-direction:column;gap:12px;">' +
            '<a href="#login" class="btn btn-primary btn-lg btn-block" onclick="sessionStorage.setItem(\'iraqiplatform_redirect\',\'license/' + courseId + '\')">🔑 Sign In</a>' +
            '<a href="#register" class="btn btn-outline btn-lg btn-block" onclick="sessionStorage.setItem(\'iraqiplatform_redirect\',\'license/' + courseId + '\')">✨ Create Account</a>' +
            '</div>' +
            '<div style="margin-top:20px;"><a href="#courses" style="color:var(--text-muted);font-size:0.85rem;">← Back to Courses</a></div>' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    // ═══════════════════════════════════════════════════════════
    // CODES MANAGEMENT — ربط أكواد Dashboard بالمنصة
    // ═══════════════════════════════════════════════════════════
    window.IRAQI_CODES = {
        getAll: getCodes,
        save: saveCodes,
        add: function (codeObj) {
            var codes = getCodes();
            var code = (codeObj.code || '').toUpperCase();
            if (!codes.find(function (c) { return c.code === code; })) {
                codes.push(Object.assign({
                    id: 'code_' + Date.now(),
                    used: false,
                    usedBy: null,
                    usedAt: null,
                    createdAt: new Date().toISOString()
                }, codeObj, { code: code }));
                saveCodes(codes);
            }
        },
        activateForUser: function (userId, courseId) {
            var users = getUsers();
            var idx = users.findIndex(function (u) { return u.id === userId; });
            if (idx < 0) return false;
            var enrolled = users[idx].enrolledCourses || [];
            if (!enrolled.some(function (id) { return String(id) === String(courseId); })) {
                users[idx].enrolledCourses = enrolled.concat([String(courseId)]);
                saveUsers(users);
                if (isLoggedIn && currentUser && currentUser.id === userId) {
                    currentUser.enrolledCourses = users[idx].enrolledCourses;
                    saveSession(currentUser);
                }
            }
            return true;
        }
    };

    // ── مزامنة أكواد Dashboard عند التحميل ──────────────────────
    (function () {
        var dashRaw = localStorage.getItem('alsaqr_codes') || localStorage.getItem('dash_codes');
        if (!dashRaw) return;
        try {
            var dashCodes = JSON.parse(dashRaw);
            var existing = getCodes();
            var existingSet = {};
            existing.forEach(function (c) { existingSet[c.code] = true; });
            var added = 0;
            dashCodes.forEach(function (dc) {
                var code = (dc.code || dc.serial || dc.key || '').toUpperCase();
                if (code && !existingSet[code]) {
                    existing.push({
                        id: dc.id || ('code_' + Date.now() + added),
                        code: code,
                        courseId: String(dc.courseId || dc.course_id || ''),
                        used: dc.used || false,
                        usedBy: dc.usedBy || null,
                        usedAt: dc.usedAt || null,
                        createdAt: dc.createdAt || new Date().toISOString()
                    });
                    existingSet[code] = true;
                    added++;
                }
            });
            if (added > 0) saveCodes(existing);
        } catch (e) { }
    })();

    // Start app
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ── refreshCoursesUI ─────────────────────────────────────────
    window.refreshCoursesUI = function () {
        try {
            var all = getAllCourses();

            // لا نحدّث الواجهة لو الكورسات فارغة — نتجنب مسح الصفحة قبل وصول Firebase
            if (!all || all.length === 0) return;

            // صفحة الكورسات الكاملة
            var grid = document.getElementById('coursesGrid');
            if (grid) {
                grid.innerHTML = all.map(function (c, i) { return renderCourseCard(c, i); }).join('');
            }

            // الكورسات في الصفحة الرئيسية (home)
            var homeGrid = document.getElementById('homeCoursesGrid');
            if (homeGrid) {
                homeGrid.innerHTML = all.map(function (c, i) { return renderCourseCard(c, i); }).join('');
            }

            // الكورسات المميزة
            var featGrid = document.getElementById('featuredCoursesGrid');
            if (featGrid) {
                featGrid.innerHTML = all.slice(0, 3).map(function (c, i) { return renderCourseCard(c, i); }).join('');
            }

            // ── إعادة تسجيل كروت الكورسات في IntersectionObserver ──
            // الكروت الجديدة عندها class "reveal" بـ opacity:0
            // لازم نضيف "visible" عليها عشان تظهر
            setTimeout(function () {
                document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
                    el.classList.add('visible');
                });
            }, 50);

        } catch (e) { console.warn('[refreshCoursesUI]', e); }
    };

    // ── استقبال تحديثات Firebase فور وصولها ─────────────────────────
    // firebase-config.js و dashboard-bridge.js بيطلقوا هذا الحدث
    // لما الكورسات تتحمل من السحابة — app.js لازم يسمعه ويحدث الواجهة
    window.addEventListener('iraqiCoursesUpdated', function () {
        try { window.refreshCoursesUI(); } catch (e) { console.warn('[iraqiCoursesUpdated]', e); }
    });

    window.addEventListener('firebaseReady', function () {
        try { window.refreshCoursesUI(); } catch (e) { console.warn('[firebaseReady]', e); }
    });

    window.addEventListener('iraqiLessonsUpdated', function () {
        try { window.refreshCoursesUI(); } catch (e) { console.warn('[iraqiLessonsUpdated]', e); }
    });

    // ── ضمان ظهور الكورسات: retry حتى تصل من Firebase ──────────────
    // يحاول كل ثانية لمدة 12 ثانية — يوقف لما الكورسات تظهر
    (function ensureCoursesVisible() {
        var attempts = 0;
        var maxAttempts = 12;
        function tryRefresh() {
            attempts++;
            try {
                var all = (typeof getAllCourses === 'function') ? getAllCourses() : [];
                var homeGrid = document.getElementById('homeCoursesGrid');
                var coursesGrid = document.getElementById('coursesGrid');
                var homeEmpty = homeGrid && homeGrid.querySelectorAll('.course-card').length === 0;
                var coursesEmpty = coursesGrid && coursesGrid.querySelectorAll('.course-card').length === 0;
                if (all.length > 0 && (homeEmpty || coursesEmpty)) {
                    window.refreshCoursesUI();
                }
                // استمر لو الكروت لسه مش ظاهرة
                var stillEmpty = (homeGrid && homeGrid.querySelectorAll('.course-card').length === 0)
                              || (coursesGrid && coursesGrid.querySelectorAll('.course-card').length === 0);
                if (stillEmpty && attempts < maxAttempts) {
                    setTimeout(tryRefresh, 1000);
                }
            } catch(e) {}
        }
        // ابدأ بعد 500ms — بعد ما DOM يتجهز
        setTimeout(tryRefresh, 500);
    })();

})();
