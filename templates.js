// ═══════════════════════════════════════════════════════════════
// templates.js — HTML Templates separated from Application Logic
// Mr. Islam Abdelwahed — Biology Platform
// ═══════════════════════════════════════════════════════════════

window.Templates = (function () {
    'use strict';

    // ── 404 Page Template ──────────────────────────────────────────
    function page404() {
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

    // ── Auth Required Template ────────────────────────────────────
    function authRequired(courseId) {
        return `
        <div style="min-height:80vh;display:flex;align-items:center;justify-content:center;padding:var(--space-2xl);">
            <div class="card" style="max-width:440px;width:100%;text-align:center;padding:var(--space-2xl);">
                <div style="font-size:4rem;margin-bottom:var(--space-md);">🔐</div>
                <h2 style="margin-bottom:var(--space-sm);">Sign In Required</h2>
                <p style="color:var(--text-secondary);margin-bottom:var(--space-xl);">
                    To access this course content, please sign in or create a new account.
                </p>
                <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                    <a href="#login" class="btn btn-primary">Sign In</a>
                    <a href="#register" class="btn btn-outline">Create Account</a>
                </div>
            </div>
        </div>`;
    }

    // ── Course Search & Filters Template ──────────────────────────
    function courseFilterBar(grades) {
        const chipsHTML = grades.map((g, i) => `
            <button class="filter-chip ${i === 0 ? 'active' : ''}" data-grade="${g}"
                onclick="filterByGrade('${g}', this)">${g}</button>
        `).join('');

        return `
        <div class="courses-filter-bar">
            <div class="filter-search">
                <span class="search-icon">🔍</span>
                <input type="text" id="courseSearchInput" placeholder="Search for a course..."
                    oninput="filterCourses()">
            </div>
            <div class="filter-chips" id="filterChips">
                ${chipsHTML}
            </div>
        </div>`;
    }

    // ── Full Courses Page Template ─────────────────────────────────
    function coursesPage(grades, coursesGridHTML) {
        return `
        <div style="padding-top:calc(var(--header-height) + var(--space-2xl));padding-bottom:var(--space-3xl);">
            <div class="container">
                <div class="text-center" style="margin-bottom:var(--space-2xl);">
                    <span class="section-badge"><span class="icon">📚</span> Courses</span>
                    <h2 class="section-title">All Available Courses</h2>
                    <p class="section-subtitle">Choose your grade level and explore courses available for you.</p>
                </div>
                ${courseFilterBar(grades)}
                <div class="courses-grid" id="coursesGrid">
                    ${coursesGridHTML}
                </div>
                <div class="empty-state" id="coursesEmpty" style="display:none;">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No Results Found</h3>
                    <p>Try changing your search keyword or grade filter.</p>
                </div>
            </div>
        </div>`;
    }

    // ── Hero Banner Template ──────────────────────────────────────
    function heroBanner(siteName) {
        return `
        <section id="homeHeroBanner" class="hb-section">
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
                    <div class="hb-img-side">
                        <h1 class="hb-heading">
                            <span class="hb-h-prefix">Biology with</span>
                            <span class="hb-h-name">Mr. Islam Abdelwahed</span>
                            <span class="hb-h-suffix">Secondary &amp; Preparatory</span>
                        </h1>
                        <div class="hb-img-frame">
                            <div class="hb-img-glow" aria-hidden="true"></div>
                            <img src="teacher-new.jpg?v=20260912" alt="Mr. Islam Abdelwahed"
                                class="hb-img" loading="eager" onerror="this.src='صورة المدرس الجديد.jpeg'">
                            <div class="hb-img-caption">
                                <span class="hb-img-badge">🧬 Biology Teacher</span>
                            </div>
                        </div>
                    </div>
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
        </section>`;
    }

    // ── 3 Steps Section Template ──────────────────────────────────
    function stepsSection() {
        return `
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
        </section>`;
    }

    // ── Teacher Section Template ──────────────────────────────────
    function teacherSection(teacherName) {
        return `
        <section class="page-section">
            <div class="container">
                <div class="teacher-section-card reveal">
                    <div class="teacher-visual">
                        <div class="teacher-avatar-circle">👨‍🏫</div>
                        <div class="teacher-name-badge">${teacherName}</div>
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
                            <a href="https://wa.me/201000000000" target="_blank" rel="noopener"
                                class="btn btn-outline btn-lg">💬 Contact Mr. Islam</a>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
    }

    // ── FAQ Section Template ──────────────────────────────────────
    function faqSection(faqItems) {
        const itemsHTML = faqItems.map((faq, idx) => `
            <div class="faq-item ${idx === 0 ? 'open' : ''}" id="faq-item-${idx}">
                <button class="faq-question" onclick="toggleFaq(${idx})">
                    <span>${faq.q}</span>
                    <span class="faq-icon">▼</span>
                </button>
                <div class="faq-answer">
                    <p>${faq.a}</p>
                </div>
            </div>
        `).join('');

        return `
        <section class="page-section" id="faq-section">
            <div class="container text-center">
                <span class="section-badge"><span class="icon">❓</span> Help &amp; Info</span>
                <h2 class="section-title">Frequently Asked Questions</h2>
                <p class="section-subtitle">Everything you need to know about registration, course activation, and using the platform.</p>
                <div class="faq-grid">
                    ${itemsHTML}
                </div>
            </div>
        </section>`;
    }

    // ── CTA Banner Template ──────────────────────────────────────
    function ctaBanner(isLoggedIn) {
        const btnsHTML = isLoggedIn ? `
            <a href="#dashboard" class="btn btn-accent btn-xl reveal reveal-delay-2">
                📊 Go to Dashboard &rarr;
            </a>
            <a href="#courses" class="btn btn-outline btn-xl reveal reveal-delay-2"
                style="border-color:#fff;color:#fff;">📚 Explore Courses</a>
        ` : `
            <a href="#register" class="btn btn-accent btn-xl reveal reveal-delay-2"
                id="ctaBannerRegisterBtn">✨ Create Free Account Now &rarr;</a>
            <a href="#login" class="btn btn-outline btn-xl reveal reveal-delay-2"
                style="border-color:#fff;color:#fff;">🔑 Sign In</a>
        `;

        return `
        <section class="cta-section">
            <div class="container text-center">
                <h2 class="reveal">Ready to Excel in Biology with Mr. Islam Abdelwahed?</h2>
                <p class="reveal reveal-delay-1">Join thousands of students and experience an engaging learning journey that makes all the difference.</p>
                <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:var(--space-xl);">
                    ${btnsHTML}
                </div>
            </div>
        </section>

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
        </section>`;
    }

    // ── Login Page Template ──────────────────────────────────────
    function loginPage(siteName) {
        return `
        <div class="auth-page">
            <div class="auth-visual">
                <div class="auth-visual-mesh"></div>
                <div class="auth-visual-content">
                    <div class="auth-teacher-badge">
                        <img src="teacher-new.jpg" alt="Mr. Islam Abdelwahed" class="auth-t-img" onerror="this.src='صورة المدرس الجديد.jpeg'">
                        <div class="auth-t-info">
                            <div class="auth-t-crown">👑</div>
                            <div class="auth-t-name">Mr. Islam Abdelwahed</div>
                            <div class="auth-t-sub">Senior Biology Teacher 🔬</div>
                        </div>
                    </div>
                    <h2 class="auth-visual-title">Welcome Back to Biology Excellence! 🔬</h2>
                    <p class="auth-visual-desc">Sign in to continue your journey toward the full mark with Mr. Islam Abdelwahed.</p>
                    <div class="auth-features-list">
                        <div class="auth-feat-item">
                            <span class="auth-feat-icon">📚</span>
                            <span>Instant access to all your active courses</span>
                        </div>
                        <div class="auth-feat-item">
                            <span class="auth-feat-icon">📊</span>
                            <span>Track your progress and test scores in real time</span>
                        </div>
                        <div class="auth-feat-item">
                            <span class="auth-feat-icon">🔔</span>
                            <span>Instant notifications on new lessons and curriculum updates</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="auth-form-side">
                <div class="auth-form-card">
                    <div class="auth-card-header">
                        <a href="#home" class="auth-logo-badge">
                            <span class="auth-logo-icon">🔬</span>
                            <span class="auth-logo-text">${siteName}</span>
                        </a>
                        <h1 class="auth-heading">Sign In</h1>
                        <p class="auth-subtitle">Enter your registered phone number and password to continue</p>
                    </div>

                    <div id="loginErrorMsg" class="auth-alert-error" style="display:none;"></div>

                    <form class="auth-form" onsubmit="event.preventDefault(); handleLogin();"
                        id="loginForm" novalidate>
                        <div class="form-group">
                            <div class="form-label-row">
                                <label class="form-label">📱 Student Phone Number</label>
                                <span class="phone-len-counter" id="loginPhoneCounter">0 / 11 digits</span>
                            </div>
                            <div class="form-input-icon-wrapper">
                                <span class="form-input-icon">📱</span>
                                <input type="tel" class="form-input phone-input"
                                    placeholder="01xxxxxxxxx" required id="loginPhone"
                                    dir="ltr" maxlength="11" inputmode="numeric"
                                    autocomplete="tel"
                                    oninput="handlePhoneInputLive(this, 'loginPhoneCounter')">
                            </div>
                            <div class="form-hint" id="loginPhoneHint">
                                Must enter 11 digits starting with 01 (numbers only)
                            </div>
                        </div>

                        <div class="form-group">
                            <div class="form-label-row">
                                <label class="form-label">🔒 Password</label>
                                <a href="#" onclick="event.preventDefault();
                                    showToast('Contact technical support to reset your password', 'info');"
                                    class="forgot-pw-link">Forgot password?</a>
                            </div>
                            <div class="form-input-icon-wrapper" style="position:relative;">
                                <span class="form-input-icon">🔒</span>
                                <input type="password" class="form-input"
                                    placeholder="Enter your password" required id="loginPassword"
                                    autocomplete="current-password">
                                <span class="password-toggle"
                                    onclick="togglePassword('loginPassword', this)"
                                    title="Show/Hide Password">👁️</span>
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
                        <a href="#register" class="auth-switch-link">Create Account Free ✨</a>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ── Register Page Template ──────────────────────────────────
    function registerPage(siteName) {
        const governorates = [
            'Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Beheira', 'Fayoum',
            'Gharbia', 'Ismailia', 'Monufia', 'Minya', 'Qalyubia', 'New Valley',
            'Suez', 'Aswan', 'Asyut', 'Beni Suef', 'Port Said', 'Damietta',
            'Sharkia', 'South Sinai', 'Kafr El Sheikh', 'Matrouh', 'Luxor', 'Qena',
            'North Sinai', 'Sohag', 'Red Sea'
        ];
        const govOptions = governorates.map(g => `<option>${g}</option>`).join('');

        return `
        <div class="auth-page">
            <div class="auth-visual">
                <div class="auth-visual-mesh"></div>
                <div class="auth-visual-content">
                    <div class="auth-teacher-badge">
                        <img src="teacher-new.jpg" alt="Mr. Islam Abdelwahed" class="auth-t-img" onerror="this.src='صورة المدرس الجديد.jpeg'">
                        <div class="auth-t-info">
                            <div class="auth-t-crown">👑</div>
                            <div class="auth-t-name">Mr. Islam Abdelwahed</div>
                            <div class="auth-t-sub">Senior Biology Teacher 🔬</div>
                        </div>
                    </div>
                    <h2 class="auth-visual-title">Join the Biology Achievers! 🎓</h2>
                    <p class="auth-visual-desc">Create your free account in seconds and get access to exclusive lessons and interactive exams.</p>
                    <div class="auth-features-list">
                        <div class="auth-feat-item">
                            <span class="auth-feat-icon">✨</span>
                            <span>Clear, structured explanations of challenging topics</span>
                        </div>
                        <div class="auth-feat-item">
                            <span class="auth-feat-icon">🎯</span>
                            <span>Comprehensive exams with instant grading &amp; model answers</span>
                        </div>
                        <div class="auth-feat-item">
                            <span class="auth-feat-icon">📊</span>
                            <span>Periodic performance tracking and progress reports</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="auth-form-side">
                <div class="auth-form-card auth-register-card">
                    <div class="auth-card-header">
                        <a href="#home" class="auth-logo-badge">
                            <span class="auth-logo-icon">🔬</span>
                            <span class="auth-logo-text">${siteName}</span>
                        </a>
                        <h1 class="auth-heading">Create Account</h1>
                        <p class="auth-subtitle">Fill in your details to join the platform</p>
                    </div>

                    <div id="registerErrorMsg" class="auth-alert-error" style="display:none;"></div>

                    <form class="auth-form"
                        onsubmit="event.preventDefault(); handleRegister();"
                        id="registerForm" novalidate>

                        <!-- Full Name -->
                        <div class="form-group">
                            <label class="form-label">👤 Student Full Name</label>
                            <div class="form-input-icon-wrapper">
                                <span class="form-input-icon">👤</span>
                                <input type="text" class="form-input"
                                    placeholder="e.g. Ahmed Mohamed Ali"
                                    required id="registerFullName" autocomplete="name">
                            </div>
                        </div>

                        <!-- Phone Numbers -->
                        <div class="form-row-auth">
                            <div class="form-group">
                                <div class="form-label-row">
                                    <label class="form-label">📱 Student Phone</label>
                                    <span class="phone-len-counter" id="regPhoneCounter">0 / 11 digits</span>
                                </div>
                                <div class="form-input-icon-wrapper">
                                    <span class="form-input-icon">📱</span>
                                    <input type="tel" class="form-input phone-input"
                                        placeholder="01xxxxxxxxx" required dir="ltr"
                                        id="registerPhone" maxlength="11" inputmode="numeric"
                                        autocomplete="tel"
                                        oninput="handlePhoneInputLive(this, 'regPhoneCounter')">
                                </div>
                            </div>
                            <div class="form-group">
                                <div class="form-label-row">
                                    <label class="form-label">📞 Parent Phone</label>
                                    <span class="phone-len-counter" id="regParentPhoneCounter">0 / 11 digits</span>
                                </div>
                                <div class="form-input-icon-wrapper">
                                    <span class="form-input-icon">📞</span>
                                    <input type="tel" class="form-input phone-input"
                                        placeholder="01xxxxxxxxx" required dir="ltr"
                                        id="registerParentPhone" maxlength="11" inputmode="numeric"
                                        autocomplete="tel"
                                        oninput="handlePhoneInputLive(this, 'regParentPhoneCounter')">
                                </div>
                            </div>
                        </div>

                        <!-- Grade & Governorate -->
                        <div class="form-row-auth">
                            <div class="form-group">
                                <label class="form-label">🎓 Grade Level</label>
                                <select class="form-select" id="registerGrade" required
                                    onchange="handleGradeChange(this.value)">
                                    <option value="">— Select Grade —</option>
                                    <optgroup label="Secondary Stage">
                                        <option value="تالتة ثانوي">3rd Year Secondary</option>
                                        <option value="تانية ثانوي">2nd Year Secondary</option>
                                        <option value="تانية ثانوي برمجة">2nd Year Secondary (Programming)</option>
                                        <option value="بكالوريا عام برمجة">General Baccalaureate (Programming)</option>
                                        <option value="أولى ثانوي">1st Year Secondary</option>
                                    </optgroup>
                                    <optgroup label="Preparatory Stage">
                                        <option value="تالتة إعدادي">3rd Year Preparatory</option>
                                        <option value="تانية إعدادي">2nd Year Preparatory</option>
                                        <option value="أولى إعدادي">1st Year Preparatory</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">📍 Governorate</label>
                                <select class="form-select" id="registerGovernorate" required>
                                    <option value="">— Select Governorate —</option>
                                    ${govOptions}
                                </select>
                            </div>
                        </div>

                        <!-- Section (For 2nd secondary) -->
                        <div class="form-group" id="sectionGroup" style="display:none;">
                            <label class="form-label">🔬 Choose Section</label>
                            <div class="section-radio-pills">
                                <label class="radio-pill-card">
                                    <input type="radio" name="registerSection"
                                        value="عام" id="sectionAmm">
                                    <span>📖 General (Scientific / Literary)</span>
                                </label>
                                <label class="radio-pill-card">
                                    <input type="radio" name="registerSection"
                                        value="بكالوريا" id="sectionBak">
                                    <span>🎓 International / Languages Baccalaureate</span>
                                </label>
                            </div>
                        </div>

                        <!-- Password -->
                        <div class="form-row-auth">
                            <div class="form-group">
                                <label class="form-label">🔒 Password
                                    <small>(6+ characters)</small></label>
                                <div class="form-input-icon-wrapper" style="position:relative;">
                                    <span class="form-input-icon">🔒</span>
                                    <input type="password" class="form-input"
                                        placeholder="Enter password" required
                                        id="registerPassword"
                                        oninput="checkPasswordStrength(this.value)"
                                        autocomplete="new-password">
                                    <span class="password-toggle"
                                        onclick="togglePassword('registerPassword', this)">👁️</span>
                                </div>
                                <div class="password-strength-bar" id="passwordStrengthBar"
                                    style="margin-top:6px;height:4px;border-radius:4px;
                                           background:var(--border);overflow:hidden;display:none;">
                                    <div id="passwordStrengthFill"
                                        style="height:100%;border-radius:4px;transition:all 0.3s;">
                                    </div>
                                </div>
                                <div id="passwordStrengthText"
                                    style="font-size:0.75rem;margin-top:4px;"></div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">🔒 Confirm Password</label>
                                <div class="form-input-icon-wrapper" style="position:relative;">
                                    <span class="form-input-icon">🔒</span>
                                    <input type="password" class="form-input"
                                        placeholder="Repeat password" required
                                        id="registerConfirmPassword"
                                        autocomplete="new-password">
                                    <span class="password-toggle"
                                        onclick="togglePassword('registerConfirmPassword', this)">👁️</span>
                                </div>
                            </div>
                        </div>

                        <!-- Terms -->
                        <div class="form-options-row">
                            <label class="remember-label">
                                <input type="checkbox" required class="custom-checkbox"
                                    id="registerTerms" checked>
                                <span>I agree to the
                                    <a href="#" onclick="event.preventDefault();
                                        showToast('Terms ensure full privacy and security of your data', 'info');"
                                        class="auth-link-terms">Terms of Service &amp; Privacy Policy</a>
                                </span>
                            </label>
                        </div>

                        <button type="submit" class="btn btn-auth-submit" id="registerSubmitBtn">
                            <span>Create Account Now</span>
                            <span class="btn-arrow-icon">✨</span>
                        </button>
                    </form>

                    <div class="auth-footer-box">
                        <span>Already have an account?</span>
                        <a href="#login" class="auth-switch-link">Sign in directly →</a>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ── Footer Template ───────────────────────────────────────────
    function footer(config, isLoggedIn, year) {
        return `
        <div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <div class="footer-logo">
                        <div class="footer-logo-icon">🧬</div>
                        <span class="footer-logo-text">${config.fullName}</span>
                    </div>
                    <p>${config.description}</p>
                    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                        <span class="badge badge-primary">Class of ${year}</span>
                        <span class="badge badge-accent">Foundation &amp; Comprehensive Content</span>
                    </div>
                </div>
                <div class="footer-col">
                    <h4>Quick Links</h4>
                    <a href="#home">Home</a>
                    <a href="#courses">All Courses</a>
                    <a href="#home" onclick="scrollToSection('courses-section')">Courses</a>
                    <a href="#home" onclick="scrollToSection('faq-section')">FAQ</a>
                    ${!isLoggedIn
                        ? '<a href="#register">Create Account</a>'
                        : '<a href="#profile">My Profile</a>'}
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
            </div>
            <div class="footer-bottom">
                <span>&copy; ${year} ${config.fullName}. All rights reserved.</span>
                <div class="footer-social">
                    <a href="https://wa.me/201000000000" target="_blank" rel="noopener"
                        aria-label="WhatsApp" title="WhatsApp">💬</a>
                    <a href="#" aria-label="Telegram" title="Telegram">✈️</a>
                    <a href="#" aria-label="Facebook" title="Facebook">📘</a>
                </div>
            </div>
        </div>`;
    }

    // ── Public API ────────────────────────────────────────────────
    return {
        page404,
        authRequired,
        coursesPage,
        courseFilterBar,
        heroBanner,
        stepsSection,
        teacherSection,
        faqSection,
        ctaBanner,
        loginPage,
        registerPage,
        footer
    };

})();
