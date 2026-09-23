// ═══════════════════════════════════════════════════════════════
// Mr. Islam Abdelwahed — Biology Platform — Data
// ═══════════════════════════════════════════════════════════════

const SITE_CONFIG = {
    name: 'الخلية',
    fullName: 'Al-Khaleya — Mr. Islam Abdelwahed',
    subtitle: 'أ/ إسلام عبدالواحد',
    description: 'The premier educational platform for Biology with Mr. Islam Abdelwahed — simplified explanations, interactive exercises, and comprehensive exams for all grade levels.',
    teacher: 'Mr. Islam Abdelwahed',
    year: 2026,
};

const QUIZ_DATA = {
    title: 'Unit 1 Exam — Cell Biology',
    questions: [
        {
            id: 'q1',
            text: 'What is the basic structural and functional unit of all living organisms?',
            options: ['Tissue', 'Cell', 'Organ', 'Organelle'],
            correct: 1
        },
        {
            id: 'q2',
            text: 'Which organelle is responsible for producing energy (ATP) in the cell?',
            options: ['Nucleus', 'Ribosome', 'Mitochondrion', 'Golgi Apparatus'],
            correct: 2
        },
        {
            id: 'q3',
            text: 'Which molecule carries the genetic information in most living organisms?',
            options: ['RNA', 'Protein', 'DNA', 'Lipid'],
            correct: 2
        },
        {
            id: 'q4',
            text: 'Which of the following gases is released by plants during photosynthesis?',
            options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'],
            correct: 2
        },
        {
            id: 'q5',
            text: 'Which type of blood cells is mainly responsible for fighting infection?',
            options: ['Red blood cells', 'White blood cells', 'Platelets', 'Plasma cells'],
            correct: 1
        }
    ]
};

const TESTIMONIALS_DATA = [
    {
        name: 'Ahmed Mohamed',
        initials: 'AM',
        text: 'The explanations are clear and easy to understand. The exams help me truly gauge my level. I got the highest score in Biology thanks to this platform.',
        rating: 5,
        grade: '3rd Year Secondary'
    },
    {
        name: 'Fatma Ali',
        initials: 'FA',
        text: 'This platform completely changed my view of Biology. I used to hate the subject, and now it\'s one of my favourites!',
        rating: 5,
        grade: '1st Year Secondary'
    },
    {
        name: 'Omar Hassan',
        initials: 'OH',
        text: 'The teacher\'s approach is excellent — step-by-step explanations. The summaries and PDF notes are very helpful during revision.',
        rating: 5,
        grade: '2nd Year Secondary'
    },
    {
        name: 'Nour Eldin',
        initials: 'NE',
        text: 'The platform is easy to use and the courses are very well organised. I recommend it to every student.',
        rating: 4,
        grade: '3rd Year Preparatory'
    },
    {
        name: 'Yasmine Khaled',
        initials: 'YK',
        text: 'The best biology platform I have used. The interactive exams are outstanding and prepare me well for actual exams.',
        rating: 5,
        grade: '3rd Year Secondary'
    },
    {
        name: 'Karim Saeed',
        initials: 'KS',
        text: 'The explanations are clear and the exercises are progressive. I noticed a significant improvement in my level in just one month.',
        rating: 5,
        grade: '1st Year Secondary'
    }
];

const FEATURES_DATA = [
    {
        icon: '💡',
        title: 'Conceptual & Simplified Explanations',
        description: 'Step-by-step explanations from the fundamentals, clarifying biological concepts with practical examples — no blind memorisation.',
        colorClass: 'green'
    },
    {
        icon: '📚',
        title: 'Full Coverage of External Textbooks',
        description: 'Comprehensive coverage of the official textbook exercises and the most challenging questions from past ministry and exam papers.',
        colorClass: 'yellow'
    },
    {
        icon: '📝',
        title: 'Interactive Electronic Exams',
        description: 'Simulated end-of-year exams with instant grading and a model answer that explains every solution step in detail.',
        colorClass: 'blue'
    },
    {
        icon: '📄',
        title: 'Exclusive PDF Notes & Summaries',
        description: 'Colour-coded notes summarising every classification, diagram and process, plus mind maps for every lesson — ready to download and print.',
        colorClass: 'green'
    },
    {
        icon: '📊',
        title: 'Performance Reports & Continuous Tracking',
        description: 'Detailed monitoring of each student\'s progress and exam scores to ensure the highest levels of academic excellence.',
        colorClass: 'yellow'
    },
    {
        icon: '💬',
        title: 'Educational Support & Q&A',
        description: 'A dedicated support team available around the clock to answer all student questions and solve difficult problems.',
        colorClass: 'blue'
    }
];

const STAGES_DATA = [
    {
        id: 'stage-3sec',
        title: '3rd Year Secondary',
        subtitle: 'Scientific Biology',
        gradeTag: 'تالتة ثانوي',
        icon: '🎯',
        description: 'Complete curriculum with exam night revisions, ministry question banks, and booklet model exams.',
        tags: ['Genetics & Evolution', 'Human Physiology', 'Ecology & Environment', 'Immunology']
    },
    {
        id: 'stage-2sec',
        title: '2nd Year Secondary',
        subtitle: 'Scientific & Literary',
        gradeTag: 'تانية ثانوي',
        icon: '📊',
        description: 'Detailed explanation of cell biology, microbiology, plant biology, and animal diversity.',
        tags: ['Cell Biology', 'Microbiology', 'Plant Biology', 'Animal Diversity']
    },
    {
        id: 'stage-1sec',
        title: '1st Year Secondary',
        subtitle: 'General & Al-Azhar',
        gradeTag: 'أولى ثانوي',
        icon: '🧬',
        description: 'Solid foundation for secondary school biology — cell structure, classification, nutrition, and reproduction.',
        tags: ['Cell Structure', 'Classification', 'Nutrition', 'Reproduction']
    },
    {
        id: 'stage-1prep',
        title: '1st Year Preparatory',
        subtitle: 'Preparatory Stage',
        gradeTag: 'أولى إعدادي',
        icon: '🌱',
        description: 'The start of excellence in preparatory stage — living organisms, cells, and plant life.',
        tags: ['Living Organisms', 'Cells & Tissues', 'Nutrition', 'Plant Life']
    },
    {
        id: 'stage-2prep',
        title: '2nd Year Preparatory',
        subtitle: 'Preparatory Stage',
        gradeTag: 'تانية إعدادي',
        icon: '📊',
        description: 'Strong foundation in human body systems, respiration, circulation, and healthy living.',
        tags: ['Human Body Systems', 'Respiration', 'Circulation', 'Health & Disease']
    },
    {
        id: 'stage-3prep',
        title: '3rd Year Preparatory',
        subtitle: 'Preparatory Certificate',
        gradeTag: 'تالتة إعدادي',
        icon: '🔬',
        description: 'In-depth explanation of preparatory curriculum ensuring full marks and qualifying for secondary.',
        tags: ['Genetics Basics', 'Ecosystems', 'Reproduction', 'Exercises']
    },
    {
        id: 'stage-free',
        title: 'Free Foundation Courses',
        subtitle: 'Available to Everyone 🎁',
        gradeTag: 'مجاني',
        icon: '🎁',
        description: '100% free introductory & foundation course to experience the teaching method and master biology essentials.',
        tags: ['Cell Basics', 'Biology Vocabulary', 'Study Skills', 'Platform Gift']
    }
];

const FAQ_DATA = [
    {
        q: 'How can I register and start watching courses?',
        a: 'Click the "Create Account" button at the top of the page and enter your details (name, phone number, grade level, and a 6-character password). After registration you can immediately watch the free courses or activate your grade\'s course with an activation code.'
    },
    {
        q: 'What is the activation code and how do I get it?',
        a: 'The activation code is a unique code used to unlock a paid course on the platform for life. You can obtain it from Mr. Islam Abdelwahed\'s centre or by contacting the technical support team directly via WhatsApp.'
    },
    {
        q: 'Are the videos and notes available throughout the academic term?',
        a: 'Yes! Once you activate a course, all videos, interactive quizzes, and PDF notes remain available to you 24 hours a day for the entire academic term — you can watch and review them as many times as you like.'
    },
    {
        q: 'Does the platform include electronic exams with instant grading?',
        a: 'Absolutely! After every unit and lesson there is an interactive electronic exam that simulates the latest Ministry of Education exam specifications, with instant grading and a detailed model answer showing every correct step.'
    },
    {
        q: 'Does the platform work on mobile, tablet, and desktop?',
        a: 'Yes. Mr. Islam Abdelwahed\'s platform is designed to run smoothly and responsively on all devices: smartphones, tablets, laptops, and desktop computers.'
    },
    {
        q: 'How can I contact Mr. Islam Abdelwahed to ask questions and follow up on assignments?',
        a: 'There is a dedicated educational team along with WhatsApp and Telegram groups for enrolled students to answer all questions, solve difficult problems, and follow up on assignments and periodic exams.'
    }
];

const STATS_DATA = [
    { icon: '👨‍🎓', number: 5000, suffix: '+', label: 'Successful Students' },
    { icon: '📚', number: 150, suffix: '+', label: 'Lessons & Lectures' },
    { icon: '⏱️', number: 120, suffix: '+', label: 'Hours of Interactive Content' },
    { icon: '⭐', number: 99, suffix: '%', label: 'Success & Excellence Rate' },
];

const CURRENT_USER = {
    name: 'Ahmed Mohamed',
    initials: 'AM',
    email: 'student@example.com',
    phone: '01012345678',
    grade: '1st Year Secondary',
    enrolledCourses: ['math-grade1-term1', 'math-grade2-term1'],
    completedLessons: 5,
    totalLessons: 54,
    avgScore: 87,
};

const ACTIVITY_DATA = [
    { icon: '✅', text: 'Completed lesson "Cell Structure"', time: '2 hours ago', color: 'green' },
    { icon: '📝', text: 'Scored 90% on Genetics Quiz', time: '5 hours ago', color: 'yellow' },
    { icon: '🎥', text: 'Watched lesson "Human Physiology"', time: 'Yesterday', color: 'blue' },
    { icon: '📄', text: 'Downloaded Unit 1 Summary PDF', time: '2 days ago', color: 'red' },
    { icon: '🏆', text: 'Successfully finished Unit 1', time: '3 days ago', color: 'green' },
];

// ═══════════════════════════════════════════════════════════════
// ADMIN CONFIG
// ═══════════════════════════════════════════════════════════════
const ADMIN_EMAIL = 'admin@iraqi.com';
const ADMIN_PASSWORD = 'adm123';

// ═══════════════════════════════════════════════════════════════
// LESSONS DATABASE — localStorage CRUD
// ═══════════════════════════════════════════════════════════════
const LESSONS_KEY = 'iraqiplatform_lessons';
const CONTENTS_KEY = 'iraqiplatform_contents';

// ── Lessons ──────────────────────────────────────────────────

function getLessons() {
    try { return JSON.parse(localStorage.getItem(LESSONS_KEY)) || []; }
    catch (e) { return []; }
}

function saveLessons(lessons) {
    localStorage.setItem(LESSONS_KEY, JSON.stringify(lessons));
    if (typeof window.FirebaseService !== 'undefined' && window.FirebaseService.lessons) {
        try { (lessons || []).forEach(l => window.FirebaseService.lessons.saveLesson(l)); } catch (e) { }
    }
}

function getCourseLessons(courseId) {
    return getLessons()
        .filter(l => l.courseId === courseId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function createLesson(courseId, data) {
    const lessons = getLessons();
    const courseLessons = getCourseLessons(courseId);
    const newLesson = {
        lessonId: 'lesson_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        courseId: courseId,
        title: data.title || 'New Lesson',
        description: data.description || '',
        order: data.order || (courseLessons.length + 1),
        status: data.status || 'published',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    lessons.push(newLesson);
    saveLessons(lessons);
    return newLesson;
}

function updateLesson(lessonId, data) {
    const lessons = getLessons();
    const idx = lessons.findIndex(l => l.lessonId === lessonId);
    if (idx === -1) return null;
    lessons[idx] = {
        ...lessons[idx],
        ...data,
        lessonId: lessonId, // لا نغيّر الـ ID
        updatedAt: new Date().toISOString(),
    };
    saveLessons(lessons);
    return lessons[idx];
}

function deleteLesson(lessonId) {
    // حذف الدرس وجميع محتوياته
    const lessons = getLessons().filter(l => l.lessonId !== lessonId);
    saveLessons(lessons);
    const contents = getContents().filter(c => c.lessonId !== lessonId);
    saveContents(contents);
}

function reorderLessons(courseId, orderedIds) {
    const lessons = getLessons();
    orderedIds.forEach((id, index) => {
        const idx = lessons.findIndex(l => l.lessonId === id);
        if (idx !== -1) {
            lessons[idx].order = index + 1;
            lessons[idx].updatedAt = new Date().toISOString();
        }
    });
    saveLessons(lessons);
}

// ── Contents ─────────────────────────────────────────────────

function getContents() {
    try { return JSON.parse(localStorage.getItem(CONTENTS_KEY)) || []; }
    catch (e) { return []; }
}

function saveContents(contents) {
    localStorage.setItem(CONTENTS_KEY, JSON.stringify(contents));
    if (typeof window.FirebaseService !== 'undefined' && window.FirebaseService.lessons) {
        try { (contents || []).forEach(c => window.FirebaseService.lessons.saveContent(c)); } catch (e) { }
    }
}

function getLessonContents(lessonId) {
    return getContents()
        .filter(c => c.lessonId === lessonId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function createContent(lessonId, data) {
    const contents = getContents();
    const lessonContents = getLessonContents(lessonId);
    const newContent = {
        contentId: 'content_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        lessonId: lessonId,
        type: data.type || 'video',
        title: data.title || 'New Content',
        content: data.content || '',
        duration: data.duration || '',
        order: data.order || (lessonContents.length + 1),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    contents.push(newContent);
    saveContents(contents);
    return newContent;
}

function updateContent(contentId, data) {
    const contents = getContents();
    const idx = contents.findIndex(c => c.contentId === contentId);
    if (idx === -1) return null;
    contents[idx] = {
        ...contents[idx],
        ...data,
        contentId: contentId,
        updatedAt: new Date().toISOString(),
    };
    saveContents(contents);
    return contents[idx];
}

function deleteContent(contentId) {
    const contents = getContents().filter(c => c.contentId !== contentId);
    saveContents(contents);
}

function reorderContents(lessonId, orderedIds) {
    const contents = getContents();
    orderedIds.forEach((id, index) => {
        const idx = contents.findIndex(c => c.contentId === id);
        if (idx !== -1) {
            contents[idx].order = index + 1;
            contents[idx].updatedAt = new Date().toISOString();
        }
    });
    saveContents(contents);
}

// ── Content Type Config ───────────────────────────────────────
const CONTENT_TYPES = [
    { value: 'video', label: 'Video', icon: '🎥', badge: 'badge-primary' },
    { value: 'pdf', label: 'PDF Document', icon: '📄', badge: 'badge-danger' },
    { value: 'quiz', label: 'Quiz', icon: '📝', badge: 'badge-accent' },
    { value: 'text', label: 'Text / Notes', icon: '📋', badge: 'badge-success' },
];

function getContentTypeConfig(type) {
    return CONTENT_TYPES.find(t => t.value === type) || CONTENT_TYPES[0];
}

// ── Bridge Helper for Student View ────────────────────────────
function getEffectiveCoursePackages(course, isEnrolled) {
    if (!course) return [];

    function normalizeVideoUrl(url) {
        return String(url || '')
            .trim()
            .replace(/[?&]autoplay=false\b/g, '')
            .replace(/\/$/, '')
            .toLowerCase();
    }

    function uniqueSegments(segs) {
        var seen = {};
        return (Array.isArray(segs) ? segs : []).filter(function (s) {
            if (!s) return false;
            var bunnyId = String(s.bunnyVideoId || '').trim();
            var videoUrl = normalizeVideoUrl(s.videoUrl || s.content || '');
            if (!bunnyId && !videoUrl) return false;
            var key = bunnyId ? ('b:' + bunnyId) : ('u:' + videoUrl);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    // ── Check Enrollment Status ────────────────────────────────
    var enrolled = isEnrolled;
    if (enrolled === undefined) {
        try {
            var session = JSON.parse(localStorage.getItem('iraqiplatform_current_user') || 'null');
            if (session && Array.isArray(session.enrolledCourses)) {
                enrolled = session.enrolledCourses.some(function (id) {
                    return String(id) === String(course.id);
                });
            }
        } catch (e) { enrolled = false; }
    }
    var courseUnlocked = !!course.isFree || !!enrolled;

    // ── 1. If course has direct lessons (Firebase / Dashboard) ──
    if (Array.isArray(course.lessons) && course.lessons.length > 0) {
        var pkgs = course.lessons.map(function (dl, idx) {
            var lessonId = String(dl.id || ('l_' + course.id + '_' + idx));
            var segs = Array.isArray(dl.segments) && dl.segments.length > 0 ? dl.segments : [];
            var validSegs = uniqueSegments(segs);

            var rawVideo = dl.videoUrl || '';
            if (!rawVideo && dl.bunnyVideoId) {
                rawVideo = 'https://iframe.mediadelivery.net/embed/691851/' + dl.bunnyVideoId + '?autoplay=false';
            }
            if (rawVideo && validSegs.length === 1) {
                var onlySegUrl = validSegs[0].bunnyVideoId
                    ? ('https://iframe.mediadelivery.net/embed/691851/' + validSegs[0].bunnyVideoId)
                    : (validSegs[0].videoUrl || '');
                if (normalizeVideoUrl(onlySegUrl) === normalizeVideoUrl(rawVideo)) rawVideo = onlySegUrl;
            }
            if (!rawVideo && validSegs.length > 0) {
                var firstS = validSegs[0];
                rawVideo = firstS.bunnyVideoId
                    ? ('https://iframe.mediadelivery.net/embed/691851/' + firstS.bunnyVideoId + '?autoplay=false')
                    : (firstS.videoUrl || '');
            }

            var hasVideo = Boolean(rawVideo || validSegs.length > 0);
            var hasPdf = Boolean(dl.pdfUrl && dl.pdfUrl.trim() !== '');
            var hasQuiz = Boolean(dl.quizId != null && dl.quizId !== '');
            var contentType = hasVideo ? 'video' : (hasQuiz ? 'quiz' : (hasPdf ? 'pdf' : 'video'));

            var pkgLessons = [];

            // Multiple video segments
            if (validSegs.length > 1) {
                validSegs.forEach(function (seg, si) {
                    var sUrl = seg.bunnyVideoId
                        ? ('https://iframe.mediadelivery.net/embed/691851/' + seg.bunnyVideoId + '?autoplay=false')
                        : (seg.videoUrl || '');
                    pkgLessons.push({
                        id: String(seg.id || (lessonId + '_seg_' + si)),
                        lessonId: lessonId,
                        title: seg.title || (dl.title + ' — Part ' + (si + 1)),
                        description: dl.description || '',
                        type: 'video',
                        duration: seg.duration || dl.duration || '—',
                        content: sUrl,
                        videoUrl: sUrl,
                        bunnyVideoId: seg.bunnyVideoId || '',
                        segments: validSegs,
                        pdfUrl: dl.pdfUrl || '',
                        pdfName: dl.pdfName || '',
                        quizId: dl.quizId || null,
                        isCompleted: false,
                        isLocked: !courseUnlocked && (idx > 0 || si > 0)
                    });
                });
            } else {
                // Single segment or standard lesson
                var singleTitle = dl.title || (validSegs[0] && validSegs[0].title) || ('Lesson ' + (idx + 1));
                var singleDuration = (validSegs[0] && validSegs[0].duration) || dl.duration || '—';
                pkgLessons.push({
                    id: lessonId,
                    lessonId: lessonId,
                    title: singleTitle,
                    description: dl.description || '',
                    type: contentType,
                    duration: singleDuration,
                    content: rawVideo || dl.pdfUrl || String(dl.quizId || ''),
                    videoUrl: rawVideo,
                    bunnyVideoId: dl.bunnyVideoId || (validSegs[0] ? validSegs[0].bunnyVideoId : ''),
                    segments: validSegs,
                    pdfUrl: dl.pdfUrl || '',
                    pdfName: dl.pdfName || '',
                    quizId: dl.quizId || null,
                    isCompleted: false,
                    isLocked: !courseUnlocked && idx > 0
                });
            }

            return {
                id: 'pkg_' + lessonId,
                title: dl.title || ('Lesson ' + (idx + 1)),
                description: dl.description || '',
                lessons: pkgLessons
            };
        });

        if (pkgs.length > 0) return pkgs;
    }

    // ── 2. Bridge dashboard courses (getDashCoursePackages) ──
    if (typeof window.getDashCoursePackages === 'function') {
        var dashPkgs = window.getDashCoursePackages(course.id);
        if (dashPkgs && dashPkgs.length > 0) {
            return dashPkgs.map(function (pkg, pIdx) {
                return Object.assign({}, pkg, {
                    lessons: (pkg.lessons || []).map(function (l, idx) {
                        return Object.assign({}, l, {
                            isLocked: !courseUnlocked && (pIdx > 0 || idx > 0)
                        });
                    })
                });
            });
        }
    }

    // ── 3. Packages embedded in course ──
    if (Array.isArray(course.packages) && course.packages.length > 0) {
        return course.packages.map(function (pkg, pIdx) {
            return Object.assign({}, pkg, {
                lessons: (pkg.lessons || []).map(function (l, idx) {
                    return Object.assign({}, l, {
                        isLocked: l.isLocked || (!courseUnlocked && (pIdx > 0 || idx > 0))
                    });
                })
            });
        });
    }

    // ── 4. Dynamic local storage lessons (fallback) ──
    var dynamicLessons = typeof getCourseLessons === 'function' ? getCourseLessons(course.id) : [];
    if (dynamicLessons && dynamicLessons.length > 0) {
        return dynamicLessons.map(function (dl, idx) {
            var contents = typeof getLessonContents === 'function' ? getLessonContents(dl.lessonId) : [];
            return {
                id: dl.lessonId,
                title: dl.title || ('Lesson ' + (idx + 1)),
                description: dl.description || '',
                lessons: contents.length > 0
                    ? contents.map(function (c, cIdx) {
                        return {
                            id: c.contentId,
                            lessonId: dl.lessonId,
                            title: c.title || ('Content ' + (cIdx + 1)),
                            type: c.type || 'video',
                            duration: c.duration || '—',
                            content: c.content || '',
                            videoUrl: c.type === 'video' ? c.content : '',
                            pdfUrl: c.type === 'pdf' ? c.content : '',
                            quizId: c.type === 'quiz' ? c.content : null,
                            isCompleted: false,
                            isLocked: !courseUnlocked && (idx > 0 || cIdx > 0)
                        };
                    })
                    : [{
                        id: dl.lessonId,
                        lessonId: dl.lessonId,
                        title: dl.title || 'Lesson Content',
                        type: 'video',
                        duration: '—',
                        content: '',
                        isCompleted: false,
                        isLocked: !courseUnlocked && idx > 0
                    }]
            };
        });
    }

    return [];
}


// ── getAllCourses: fallback إذا لم يُحمَّل dashboard-bridge.js ──
if (typeof window !== 'undefined') {
    window.SITE_CONFIG = SITE_CONFIG;
    window.COURSES_DATA = COURSES_DATA;
    window.STAGES_DATA = STAGES_DATA;
    window.FAQ_DATA = typeof FAQ_DATA !== 'undefined' ? FAQ_DATA : [];
    window.FEATURES_DATA = typeof FEATURES_DATA !== 'undefined' ? FEATURES_DATA : [];
    if (typeof window.getAllCourses !== 'function') {
        window.getAllCourses = function () { return COURSES_DATA; };
    }
}

// ================================================================
// Lesson Progress & Quiz-Gate System
// ================================================================
(function () {
    var PROGRESS_KEY = 'iraqi_lesson_progress';

    function getProgress() {
        try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch(e) { return {}; }
    }

    window.isLessonCompleted = function(userId, courseId, lessonId) {
        if (!userId || !courseId || !lessonId) return false;
        return !!getProgress()[userId + '_' + courseId + '_' + lessonId];
    };

    window.markLessonCompleted = function(userId, courseId, lessonId) {
        if (!userId || !courseId || !lessonId) return;
        var p = getProgress();
        var k = userId + '_' + courseId + '_' + lessonId;
        if (p[k]) return;
        p[k] = true;
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
        if (window.db) {
            window.db.collection('lesson_progress').doc(k).set(
                { userId: userId, courseId: courseId, lessonId: lessonId, completedAt: new Date().toISOString() },
                { merge: true }
            ).catch(function() {});
        }
        try { window.dispatchEvent(new CustomEvent('lessonCompleted', { detail: { userId: userId, courseId: courseId, lessonId: lessonId } })); } catch(_) {}
    };

    // Returns { canAccess:bool, reason?:string, quizId?:string, passRate?:number, achieved?:number }
    window.getLessonAccessStatus = function(userId, courseId, allLessons, targetLesson) {
        if (!allLessons || !allLessons.length || !targetLesson) return { canAccess: true };
        var idx = allLessons.findIndex(function(l) { return String(l.id) === String(targetLesson.id); });
        if (idx <= 0) return { canAccess: true };
        var prev = allLessons[idx - 1];
        if (!prev || !prev.quizId) return { canAccess: true };
        var quizId  = prev.quizId;
        var quiz    = (typeof window.getQuizById === 'function') ? window.getQuizById(quizId) : null;
        var passRate = quiz ? (quiz.averageGrade || quiz.passingGrade || 50) : 50;
        var attempt  = (typeof window.getQuizAttempt === 'function' && userId)
            ? window.getQuizAttempt(userId, quizId) : null;
        if (!attempt) return { canAccess: false, reason: 'quiz_required', quizId: quizId, passRate: passRate, prevLessonTitle: prev.title };
        var pct = attempt.percentage !== undefined ? attempt.percentage
            : (attempt.total > 0 ? Math.round(attempt.score / attempt.total * 100) : 0);
        if (pct < passRate) return { canAccess: false, reason: 'quiz_failed', quizId: quizId, passRate: passRate, achieved: pct, prevLessonTitle: prev.title };
        return { canAccess: true, quizPassed: true };
    };

    window.enrichLessonsWithProgress = function(userId, courseId, lessons) {
        if (!lessons || !lessons.length) return lessons;
        return lessons.map(function(lesson, idx) {
            var completed = userId ? window.isLessonCompleted(userId, courseId, lesson.id) : false;
            var access    = window.getLessonAccessStatus(userId, courseId, lessons, lesson);
            return Object.assign({}, lesson, {
                isCompleted: completed,
                isLocked: !access.canAccess,
                _accessStatus: access
            });
        });
    };

    console.info('[Progress] Lesson progress & quiz-gate system ready.');
})();

// ═══════════════════════════════════════════════════════════════
// نظام تتبع تقدم الطالب وربط الاختبارات بفتح الدروس
// Lesson Progress & Quiz-Gate System
// ═══════════════════════════════════════════════════════════════
(function () {
    var PROGRESS_KEY = 'iraqi_lesson_progress'; // { userId_courseId_lessonId: true }

    // ── جلب تقدم الطالب ─────────────────────────────────────────
    function getLessonProgress() {
        try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
        catch (e) { return {}; }
    }

    // ── هل أتم الطالب الدرس؟ ────────────────────────────────────
    window.isLessonCompleted = function (userId, courseId, lessonId) {
        if (!userId || !courseId || !lessonId) return false;
        var key = userId + '_' + courseId + '_' + lessonId;
        return !!getLessonProgress()[key];
    };

    // ── تسجيل إتمام الدرس ───────────────────────────────────────
    window.markLessonCompleted = function (userId, courseId, lessonId) {
        if (!userId || !courseId || !lessonId) return;
        var progress = getLessonProgress();
        var key = userId + '_' + courseId + '_' + lessonId;
        if (progress[key]) return; // already marked
        progress[key] = true;
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
        // مزامنة مع Firebase إذا متاح
        if (window.db) {
            window.db.collection('lesson_progress').doc(key).set({
                userId: userId, courseId: courseId, lessonId: lessonId,
                completedAt: new Date().toISOString()
            }, { merge: true }).catch(function () {});
        }
        // أطلق حدث عشان الواجهة تتحدث
        window.dispatchEvent(new CustomEvent('lessonCompleted', {
            detail: { userId: userId, courseId: courseId, lessonId: lessonId }
        }));
    };

    // ── هل يحق للطالب الوصول للدرس؟ (مع منطق الاختبار) ─────────
    // يعود بـ { canAccess: bool, reason: string, quizId: string|null }
    window.getLessonAccessStatus = function (userId, courseId, allLessons, targetLesson) {
        if (!allLessons || !allLessons.length || !targetLesson) return { canAccess: true };
        var idx = allLessons.findIndex(function (l) {
            return String(l.id) === String(targetLesson.id);
        });
        if (idx <= 0) return { canAccess: true }; // أول درس دايمًا متاح

        // فحص الدرس السابق
        var prevLesson = allLessons[idx - 1];
        if (!prevLesson) return { canAccess: true };

        // إذا الدرس السابق مش مرتبط باختبار → الوصول مفتوح (ولكن بعد الإتمام)
        if (!prevLesson.quizId) {
            // إذا في tracking للإتمام — نتحقق، وإلا نسمح
            var completed = userId ? window.isLessonCompleted(userId, courseId, prevLesson.id) : false;
            // للدروس بدون اختبار → السماح بالوصول تلقائيًا (لا نقفل)
            return { canAccess: true };
        }

        // الدرس السابق مرتبط باختبار → نتحقق من النتيجة
        var quizId = prevLesson.quizId;
        var quiz = (typeof window.getQuizById === 'function') ? window.getQuizById(quizId) : null;
        var passRate = quiz ? (quiz.averageGrade || quiz.passingGrade || 50) : 50;
        var attempt = (typeof window.getQuizAttempt === 'function' && userId)
            ? window.getQuizAttempt(userId, quizId) : null;

        if (!attempt) {
            return {
                canAccess: false,
                reason: 'quiz_required',
                quizId: quizId,
                passRate: passRate,
                prevLessonTitle: prevLesson.title
            };
        }

        var pct = attempt.percentage !== undefined ? attempt.percentage
            : (attempt.total > 0 ? Math.round(attempt.score / attempt.total * 100) : 0);

        if (pct < passRate) {
            return {
                canAccess: false,
                reason: 'quiz_failed',
                quizId: quizId,
                passRate: passRate,
                achieved: pct,
                prevLessonTitle: prevLesson.title
            };
        }

        return { canAccess: true, quizPassed: true };
    };

    // ── تحديث isCompleted و isLocked على قائمة الدروس ────────────
    window.enrichLessonsWithProgress = function (userId, courseId, lessons) {
        if (!userId || !courseId || !lessons || !lessons.length) return lessons;
        return lessons.map(function (lesson, idx) {
            var completed = window.isLessonCompleted(userId, courseId, lesson.id);
            var access = window.getLessonAccessStatus(userId, courseId, lessons, lesson);
            return Object.assign({}, lesson, {
                isCompleted: completed,
                isLocked: lesson.isLocked || !access.canAccess,
                _accessStatus: access
            });
        });
    };

    console.info('[Progress System] ✅ Lesson progress & quiz-gate system loaded');
})();
