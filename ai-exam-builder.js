/**
 * ai-exam-builder.js v1.0
 * AI Exam Builder — integrated with StorageEngine / CloudSync
 */
const AIExamBuilder = (() => {
    'use strict';
    const AI_PROVIDERS = {
        google: { name: 'Google Gemini', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'], endpoint: (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent` },
        openai: { name: 'OpenAI GPT', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'], endpoint: () => 'https://api.openai.com/v1/chat/completions' }
    };
    let _draft = null, _view = 'list', _editId = null;

    const genId = (p = 'ai') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    function genCode() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join(''); }
    function getAICfg() { try { const s = localStorage.getItem('edu_ai_config_' + (window.APP_TENANT_ID || 'default')); if (s) return JSON.parse(s); } catch (_) { } return (window.db?._settings?.aiConfig) || { apiKey: '', provider: 'google', model: 'gemini-1.5-flash' }; }
    function saveAICfg(c) { try { localStorage.setItem('edu_ai_config_' + (window.APP_TENANT_ID || 'default'), JSON.stringify(c)); } catch (_) { } if (window.db) { if (!window.db._settings) window.db._settings = {}; window.db._settings.aiConfig = c; } }
    function notify(m, t = 'info') { if (typeof window.showNotification === 'function') window.showNotification(m, t); else console.log('[AIExam]', m); }
    async function saveRec(table, rec) { if (!window.db[table]) window.db[table] = []; const i = window.db[table].findIndex(r => r.id === rec.id); if (i !== -1) window.db[table][i] = rec; else window.db[table].push(rec); if (typeof StorageEngine !== 'undefined') await StorageEngine.save(table, rec); if (typeof window.updateDataInFile === 'function') window.updateDataInFile(); if (typeof CloudSync !== 'undefined' && CloudSync.isReady?.()) try { CloudSync.onLocalSave(table); } catch (_) { } }
    async function delRec(table, id) { if (window.db[table]) window.db[table] = window.db[table].filter(r => r.id !== id); if (typeof StorageEngine !== 'undefined' && StorageEngine.db) { const tx = StorageEngine.db.transaction([table], 'readwrite'); tx.objectStore(table).delete(id); } if (typeof window.updateDataInFile === 'function') window.updateDataInFile(); }
    function fmt(s) { const m = Math.floor((s || 0) / 60), sec = (s || 0) % 60; return `${m}:${String(sec).padStart(2, '0')}`; }
    async function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) { res(); return; } const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('فشل تحميل ' + src)); document.head.appendChild(el); }); }

    async function callAI(prompt, img = null) {
        const cfg = getAICfg();
        if (!cfg.apiKey) throw new Error('لم يتم إعداد مفتاح API. اذهب لإعدادات AI.');
        const prov = AI_PROVIDERS[cfg.provider] || AI_PROVIDERS.google;
        const model = cfg.model || prov.models[0];
        if (cfg.provider === 'openai') {
            const content = img ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } }] : prompt;
            const res = await fetch(prov.endpoint(), { method: 'POST', headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content }], max_tokens: 8000, response_format: { type: 'json_object' } }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
            const d = await res.json(); return JSON.parse(d.choices[0].message.content);
        }
        const parts = [{ text: prompt }];
        if (img) parts.push({ inline_data: { mime_type: 'image/jpeg', data: img } });
        const res = await fetch(`${prov.endpoint(model)}?key=${cfg.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8000 } }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
        const d = await res.json();
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('لم يرد الذكاء الاصطناعي.');
        return JSON.parse(text);
    }

    function buildPrompt(fd, material) {
        const tl = { mcq: 'اختيار متعدد (4 خيارات)', tf: 'صح أو خطأ', fill: 'أكمل الفراغ', essay: 'مقالي' };
        const dl = { easy: 'سهل', medium: 'متوسط', hard: 'صعب', mixed: 'متنوع' };
        return `أنت مساعد تعليمي. أنشئ اختبار شامل بالعربية.\nبيانات:\n- العنوان: ${fd.title}\n- الهدف: ${fd.description || 'اختبار تحصيلي'}\n- المستوى: ${dl[fd.difficulty] || 'متوسط'}\n- عدد الأسئلة: ${fd.totalQuestions}\n- الدرجة الكلية: ${fd.totalMarks}\n- أنواع الأسئلة: ${fd.questionTypes.map(t => tl[t] || t).join(' و ')}\nالمادة:\n${material || 'أنشئ أسئلة مناسبة للموضوع والمستوى'}\nالقواعد:\n1- وزّع الأسئلة بالتساوي\n2- اختيار متعدد: 4 خيارات مع الإجابة الصحيحة\n3- مجموع الدرجات = ${fd.totalMarks}\nأعد JSON فقط:\n{"questions":[{"type":"mcq","text":"السؤال","options":["أ","ب","ج","د"],"answer":"الخيار الصحيح","marks":5,"explanation":""},{"type":"tf","text":"العبارة","options":["صحيح","خطأ"],"answer":"صحيح","marks":2,"explanation":""},{"type":"fill","text":"أكمل: ____","answer":"الكلمة","marks":3,"explanation":""},{"type":"essay","text":"اشرح...","answer":"النقاط","marks":10,"explanation":""}]}`;
    }

    async function genQs(fd, material, img = null) {
        const r = await callAI(buildPrompt(fd, material), img);
        if (!Array.isArray(r.questions)) throw new Error('صيغة رد غير صحيحة');
        return r.questions.map((q, i) => ({ ...q, id: `q_${i + 1}_${Date.now()}`, order: i + 1 }));
    }

    async function f2b64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); }); }
    async function extractFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { type: 'image', base64: await f2b64(file), text: '' };
        if (ext === 'pdf') { if (!window.pdfjsLib) { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } const buf = await file.arrayBuffer(); const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise; let txt = ''; for (let i = 1; i <= pdf.numPages; i++) { const p = await pdf.getPage(i); const c = await p.getTextContent(); txt += c.items.map(s => s.str).join(' ') + '\n'; } return { type: 'text', text: txt, base64: null }; }
        if (['doc', 'docx'].includes(ext)) { if (!window.mammoth) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'); const buf = await file.arrayBuffer(); const r = await window.mammoth.extractRawText({ arrayBuffer: buf }); return { type: 'text', text: r.value, base64: null }; }
        return { type: 'text', text: await file.text(), base64: null };
    }

    function buildExamUrl(code) { return window.location.href.replace(/index\.html.*$/, '') + 'ai-exam.html?code=' + code; }
    function genQR(code, cid) { const el = document.getElementById(cid); if (!el) return; el.innerHTML = ''; const url = buildExamUrl(code); if (typeof QRCode !== 'undefined') new QRCode(el, { text: url, width: 90, height: 90, correctLevel: QRCode.CorrectLevel.M }); else { const img = document.createElement('img'); img.src = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(url)}`; img.style.borderRadius = '6px'; el.appendChild(img); } }

    async function saveExam(exam) { await saveRec('aiExams', exam); }
    async function delExam(id) { if (!confirm('حذف الاختبار وجميع جلساته؟')) return; await delRec('aiExams', id); for (const s of ((window.db && window.db.aiExamSessions) || []).filter(s => s.examId === id)) await delRec('aiExamSessions', s.id); notify('تم الحذف', 'success'); renderList(); }
    async function toggleStatus(id) { const e = ((window.db && window.db.aiExams) || []).find(e => e.id === id); if (!e) return; e.status = e.status === 'active' ? 'closed' : 'active'; await saveExam(e); notify(e.status === 'active' ? '✅ تم التفعيل' : '⏸ تم الإيقاف', 'success'); renderList(); }

    function init() { const w = document.getElementById('ai-exam-builder-section'); if (!w) return; renderList(); }

    function renderList() {
        const w = document.getElementById('ai-exam-builder-section'); if (!w) return;
        _view = 'list';
        const exams = (window.db && window.db.aiExams) || [];
        const sessions = (window.db && window.db.aiExamSessions) || [];
        const done = sessions.filter(s => s.status === 'submitted');
        const avg = done.length ? Math.round(done.reduce((a, s) => a + (s.percentage || 0), 0) / done.length) : 0;
        w.innerHTML = `
<div class="aie-wrap">
<div class="aie-head">
  <div>
    <h1 class="aie-h1"><i class="fas fa-robot"></i> الاختبارات بالذكاء الاصطناعي</h1>
    <p class="aie-sub">أنشئ اختبارات احترافية في ثوانٍ باستخدام Gemini أو ChatGPT</p>
  </div>
  <div style="display:flex;gap:.8rem;flex-wrap:wrap">
    <button class="aie-btn aie-ghost" onclick="AIExamBuilder.openCfg()"><i class="fas fa-cog"></i> إعدادات AI</button>
    <button class="aie-btn aie-primary" onclick="AIExamBuilder.renderCreate()"><i class="fas fa-plus"></i> اختبار جديد</button>
  </div>
</div>
<div class="aie-stats">
  <div class="aie-sc" style="border-right:4px solid var(--primary)"><div class="aie-si" style="background:rgba(79,70,229,.1);color:var(--primary)"><i class="fas fa-file-alt"></i></div><div><div class="aie-sn">${exams.length}</div><div class="aie-sl">الاختبارات</div></div></div>
  <div class="aie-sc" style="border-right:4px solid var(--accent)"><div class="aie-si" style="background:rgba(16,185,129,.1);color:var(--accent)"><i class="fas fa-play-circle"></i></div><div><div class="aie-sn">${exams.filter(e => e.status === 'active').length}</div><div class="aie-sl">نشطة</div></div></div>
  <div class="aie-sc" style="border-right:4px solid #0ea5e9"><div class="aie-si" style="background:rgba(14,165,233,.1);color:#0ea5e9"><i class="fas fa-users"></i></div><div><div class="aie-sn">${sessions.length}</div><div class="aie-sl">جلسات</div></div></div>
  <div class="aie-sc" style="border-right:4px solid var(--warning)"><div class="aie-si" style="background:rgba(245,158,11,.1);color:var(--warning)"><i class="fas fa-chart-bar"></i></div><div><div class="aie-sn">${avg}%</div><div class="aie-sl">متوسط الدرجات</div></div></div>
</div>
<div class="aie-card">
  <div class="aie-card-hd">
    <h3 style="margin:0;font-weight:800"><i class="fas fa-list-alt"></i> قائمة الاختبارات</h3>
    ${exams.length ? `<input class="aie-srch" placeholder="بحث..." oninput="AIExamBuilder.filterList(this.value)">` : ''}
  </div>
  <div id="aie-lb">${exams.length ? buildCards(exams) : `<div style="text-align:center;padding:3rem;color:var(--text-muted)"><i class="fas fa-robot" style="font-size:3rem;opacity:.2;margin-bottom:1rem;display:block"></i><h3>لا توجد اختبارات بعد</h3><p style="margin:.5rem 0 1.5rem">أنشئ أول اختبار الآن</p><button class="aie-btn aie-primary" onclick="AIExamBuilder.renderCreate()"><i class="fas fa-magic"></i> إنشاء اختبار</button></div>`}</div>
</div>
</div>`;
        injectCSS();
        setTimeout(() => exams.forEach(e => genQR(e.examCode, 'aie-qr-' + e.id)), 200);
    }

    function buildCards(exams) {
        return exams.map(exam => {
            const sl = ((window.db && window.db.aiExamSessions) || []).filter(s => s.examId === exam.id);
            const sub = sl.filter(s => s.status === 'submitted');
            const avgP = sub.length ? Math.round(sub.reduce((a, s) => a + (s.percentage || 0), 0) / sub.length) : null;
            const act = exam.status === 'active';
            const dc = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444', mixed: '#8b5cf6' }[exam.difficulty] || '#64748b';
            const url = buildExamUrl(exam.examCode);
            return `<div class="aie-ec" data-exam-id="${exam.id}">
<div style="display:flex;align-items:flex-start;gap:1rem;margin-bottom:.8rem">
  <div style="width:44px;height:44px;background:linear-gradient(135deg,var(--primary),#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;flex-shrink:0"><i class="fas fa-brain"></i></div>
  <div style="flex:1;min-width:0">
    <div style="font-size:1rem;font-weight:800;margin-bottom:.3rem">${exam.title}</div>
    <div style="display:flex;flex-wrap:wrap;gap:.6rem;font-size:.76rem;color:var(--text-muted)">
      ${exam.grade ? `<span><i class="fas fa-graduation-cap"></i> ${exam.grade}</span>` : ''}
      <span><i class="fas fa-question-circle"></i> ${exam.questions?.length || 0} سؤال</span>
      <span><i class="fas fa-star"></i> ${exam.totalMarks} درجة</span>
      <span style="color:${dc};font-weight:700">${{ easy: 'سهل', medium: 'متوسط', hard: 'صعب', mixed: 'متنوع' }[exam.difficulty] || ''}</span>
      <span><i class="fas fa-calendar-alt"></i> ${new Date(exam.createdAt).toLocaleDateString('ar-EG')}</span>
    </div>
  </div>
  <span style="padding:.2rem .65rem;border-radius:99px;font-size:.73rem;font-weight:700;flex-shrink:0;${act ? 'background:rgba(16,185,129,.1);color:var(--accent)' : 'background:rgba(0,0,0,.06);color:var(--text-muted)'}">
    <i class="fas fa-circle" style="font-size:.4rem;vertical-align:middle"></i> ${act ? 'نشط' : 'متوقف'}
  </span>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;background:var(--bg-light);border-radius:10px;padding:.65rem;margin-bottom:.8rem;text-align:center">
  <div><div style="font-size:1.05rem;font-weight:900;color:var(--primary)">${sl.length}</div><div style="font-size:.67rem;color:var(--text-muted);font-weight:600">جلسة</div></div>
  <div><div style="font-size:1.05rem;font-weight:900;color:var(--accent)">${sub.length}</div><div style="font-size:.67rem;color:var(--text-muted);font-weight:600">أتم</div></div>
  <div><div style="font-size:.95rem;font-weight:900;color:${avgP === null ? 'var(--text-muted)' : avgP >= 50 ? 'var(--accent)' : 'var(--danger)'}">${avgP !== null ? avgP + '%' : '—'}</div><div style="font-size:.67rem;color:var(--text-muted);font-weight:600">متوسط</div></div>
  <div><div style="font-size:.8rem;font-weight:900;color:#8b5cf6;letter-spacing:1px">${exam.examCode}</div><div style="font-size:.67rem;color:var(--text-muted);font-weight:600">الكود</div></div>
</div>
<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;background:var(--bg-light);border-radius:99px;margin-bottom:.8rem;overflow:hidden">
  <i class="fas fa-link" style="color:var(--text-muted);font-size:.78rem;flex-shrink:0"></i>
  <span style="flex:1;font-size:.7rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace">${url}</span>
  <button style="background:none;border:none;cursor:pointer;color:var(--primary);padding:.2rem .45rem;border-radius:6px;font-size:.85rem" onclick="AIExamBuilder.copyUrl('${exam.examCode}')"><i class="fas fa-copy"></i></button>
  <div id="aie-qr-${exam.id}" style="flex-shrink:0"></div>
</div>
<div style="display:flex;gap:.5rem;flex-wrap:wrap">
  <button class="aie-btn aie-ghost aie-sm" onclick="AIExamBuilder.viewRes('${exam.id}')"><i class="fas fa-chart-pie"></i> النتائج</button>
  <button class="aie-btn aie-ghost aie-sm" onclick="AIExamBuilder.editExam('${exam.id}')"><i class="fas fa-edit"></i> تعديل</button>
  <button class="aie-btn aie-sm" style="${act ? 'background:rgba(245,158,11,.1);color:var(--warning);border:1px solid rgba(245,158,11,.2)' : 'background:rgba(16,185,129,.1);color:var(--accent);border:1px solid rgba(16,185,129,.2)'}" onclick="AIExamBuilder.toggleSt('${exam.id}')">
    <i class="fas fa-${act ? 'pause' : 'play'}"></i> ${act ? 'إيقاف' : 'تفعيل'}
  </button>
  <button class="aie-btn aie-sm" style="background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.2);margin-right:auto" onclick="AIExamBuilder.delExam('${exam.id}')"><i class="fas fa-trash"></i></button>
</div>
</div>`;
        }).join('');
    }

    function filterList(q) {
        const exams = ((window.db && window.db.aiExams) || []).filter(e => e.title.includes(q) || e.examCode.includes(q) || (e.grade || '').includes(q));
        const b = document.getElementById('aie-lb'); if (b) b.innerHTML = exams.length ? buildCards(exams) : `<div style="padding:2rem;text-align:center;color:var(--text-muted)">لا توجد نتائج</div>`;
        setTimeout(() => exams.forEach(e => genQR(e.examCode, 'aie-qr-' + e.id)), 100);
    }

    function renderCreate() {
        const w = document.getElementById('ai-exam-builder-section'); if (!w) return;
        _view = 'create'; window._aie_file = null;
        const grades = window.gradesList || [];
        const groups = (window.db && window.db.groups) || [];
        const cfg = getAICfg();
        w.innerHTML = `<div class="aie-wrap">
<div class="aie-head">
  <div>
    <button class="aie-back" onclick="AIExamBuilder.init()"><i class="fas fa-arrow-right"></i> رجوع</button>
    <h1 class="aie-h1" style="margin-top:.5rem"><i class="fas fa-magic"></i> إنشاء اختبار جديد</h1>
  </div>
</div>
<div class="aie-cgrid">
<div class="aie-card">
  <h3 class="aie-stitle"><i class="fas fa-info-circle"></i> معلومات الاختبار</h3>
  <div class="fg"><label class="aie-lbl">عنوان الاختبار *</label><input id="aie-ttl" class="aie-inp" placeholder="مثال: اختبار الوحدة الأولى"></div>
  <div class="fg"><label class="aie-lbl">الهدف / الوصف</label><textarea id="aie-dsc" class="aie-inp aie-ta" placeholder="ما الذي تريد قياسه؟"></textarea></div>
  <div class="aie-r3">
    <div class="fg"><label class="aie-lbl">الصف</label><select id="aie-grd" class="aie-inp"><option value="">-- الكل --</option>${grades.map(g => `<option value="${g}">${g}</option>`).join('')}</select></div>
    <div class="fg"><label class="aie-lbl">المجموعة</label><select id="aie-grp" class="aie-inp"><option value="">-- الكل --</option>${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}</select></div>
    <div class="fg"><label class="aie-lbl">المستوى</label><select id="aie-dif" class="aie-inp"><option value="easy">سهل</option><option value="medium" selected>متوسط</option><option value="hard">صعب</option><option value="mixed">متنوع</option></select></div>
  </div>
  <div class="aie-r3" style="margin-top:.7rem">
    <div class="fg"><label class="aie-lbl">عدد الأسئلة</label><input id="aie-qn" type="number" class="aie-inp" value="10" min="3" max="50"></div>
    <div class="fg"><label class="aie-lbl">الدرجة الكلية</label><input id="aie-mk" type="number" class="aie-inp" value="50" min="10"></div>
  </div>
  <h3 class="aie-stitle" style="margin-top:1.3rem"><i class="fas fa-list-check"></i> أنواع الأسئلة</h3>
  <div style="display:flex;flex-wrap:wrap;gap:.65rem">
    <label class="aie-chk"><input type="checkbox" name="aie-qt" value="mcq" checked> اختيار متعدد</label>
    <label class="aie-chk"><input type="checkbox" name="aie-qt" value="tf"> صح أو خطأ</label>
    <label class="aie-chk"><input type="checkbox" name="aie-qt" value="fill"> أكمل الفراغ</label>
    <label class="aie-chk"><input type="checkbox" name="aie-qt" value="essay"> مقالي</label>
  </div>
</div>
<div>
<div class="aie-card">
  <h3 class="aie-stitle"><i class="fas fa-book-open"></i> مصدر المادة العلمية</h3>
  <div class="aie-tabs">
    <button class="aie-tab active" onclick="AIExamBuilder.swSrc('text',this)"><i class="fas fa-keyboard"></i> نص</button>
    <button class="aie-tab" onclick="AIExamBuilder.swSrc('file',this)"><i class="fas fa-file-upload"></i> ملف</button>
    <button class="aie-tab" onclick="AIExamBuilder.swSrc('auto',this)"><i class="fas fa-magic"></i> تلقائي</button>
  </div>
  <div id="aie-src-text"><textarea id="aie-mat" class="aie-inp aie-ta" style="height:170px" placeholder="الصق المادة العلمية — درس، فصل، ملخص..."></textarea></div>
  <div id="aie-src-file" style="display:none">
    <div class="aie-drop" id="aie-drop" ondragover="event.preventDefault();this.classList.add('aie-over')" ondragleave="this.classList.remove('aie-over')" ondrop="AIExamBuilder.onDrop(event)">
      <i class="fas fa-cloud-upload-alt" style="font-size:2rem;color:var(--primary);margin-bottom:.5rem;display:block"></i>
      <p style="font-weight:700;margin:.3rem 0">اسحب الملف هنا أو</p>
      <label class="aie-btn aie-ghost" style="cursor:pointer;margin-top:.3rem"><i class="fas fa-folder-open"></i> اختر ملف<input type="file" id="aie-fi" style="display:none" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onchange="AIExamBuilder.onFile(this)"></label>
      <p style="font-size:.74rem;color:var(--text-muted);margin-top:.5rem">PDF · Word · صور · نص</p>
    </div>
    <div id="aie-fi-info" style="display:none;margin-top:.7rem;padding:.7rem;background:var(--bg-light);border-radius:9px;font-size:.83rem"></div>
  </div>
  <div id="aie-src-auto" style="display:none">
    <div style="text-align:center;padding:1.4rem;background:linear-gradient(135deg,rgba(79,70,229,.05),rgba(16,185,129,.05));border-radius:12px;border:2px dashed rgba(79,70,229,.15)">
      <i class="fas fa-sparkles" style="font-size:1.7rem;color:var(--primary);margin-bottom:.5rem;display:block"></i>
      <p style="color:var(--text-muted);font-size:.88rem">سيولّد AI الأسئلة بناءً على العنوان والوصف</p>
    </div>
  </div>
</div>
${!cfg.apiKey ? `<div class="aie-alert aie-warn" style="margin-bottom:1rem"><i class="fas fa-exclamation-triangle"></i> مفتاح AI غير مُعدّ — <button class="aie-link-btn" onclick="AIExamBuilder.openCfg()">أعدّه الآن</button></div>` : `<div class="aie-alert aie-ok" style="margin-bottom:1rem"><i class="fas fa-check-circle"></i> AI جاهز: <strong>${cfg.provider === 'google' ? 'Google Gemini' : 'OpenAI'}</strong> — ${cfg.model}</div>`}
<button class="aie-btn aie-primary" style="width:100%;height:52px;font-size:1rem;border-radius:13px;margin-bottom:.75rem" onclick="AIExamBuilder.startGen()"><i class="fas fa-magic"></i> توليد الأسئلة بالذكاء الاصطناعي</button>
<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem"><div style="flex:1;height:1px;background:var(--border)"></div><span style="font-size:.75rem;color:var(--text-muted);font-weight:700;white-space:nowrap">أو</span><div style="flex:1;height:1px;background:var(--border)"></div></div>
<button class="aie-btn aie-ghost" style="width:100%;height:48px;font-size:.95rem;border-radius:13px;border:2px dashed var(--border)" onclick="AIExamBuilder.startManual()"><i class="fas fa-pencil-alt" style="color:#8b5cf6"></i> إنشاء الأسئلة يدوياً</button>
<div id="aie-gp" style="display:none;margin-top:1rem">
  <div style="height:7px;background:#e2e8f0;border-radius:99px;overflow:hidden"><div id="aie-pb" style="height:100%;background:linear-gradient(90deg,var(--primary),#7c3aed);border-radius:99px;width:0;transition:width .3s"></div></div>
  <p id="aie-pt" style="text-align:center;color:var(--text-muted);font-size:.8rem;margin-top:.4rem">جاري التحليل...</p>
</div>
</div>
</div>
</div>`;
        injectCSS();
    }

    function swSrc(type, btn) {
        document.querySelectorAll('.aie-tab').forEach(t => t.classList.remove('active'));
        ['text', 'file', 'auto'].forEach(t => { const el = document.getElementById(`aie-src-${t}`); if (el) el.style.display = t === type ? 'block' : 'none'; });
        btn.classList.add('active');
    }
    async function onFile(input) { if (input.files.length) await procFile(input.files[0]); }
    async function onDrop(e) { e.preventDefault(); document.getElementById('aie-drop')?.classList.remove('aie-over'); if (e.dataTransfer.files[0]) await procFile(e.dataTransfer.files[0]); }
    async function procFile(file) {
        const info = document.getElementById('aie-fi-info');
        if (info) { info.style.display = 'block'; info.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري قراءة: ${file.name}`; }
        try { const d = await extractFile(file); window._aie_file = d; if (info) info.innerHTML = d.type === 'image' ? `<i class="fas fa-image" style="color:var(--accent)"></i> تم تحميل الصورة <strong>${file.name}</strong>` : `<i class="fas fa-check-circle" style="color:var(--accent)"></i> <strong>${file.name}</strong> — ${d.text.trim().split(/\s+/).length} كلمة`; }
        catch (err) { if (info) info.innerHTML = `<i class="fas fa-times-circle" style="color:var(--danger)"></i> خطأ: ${err.message}`; }
    }

    async function startGen() {
        const title = document.getElementById('aie-ttl')?.value?.trim();
        if (!title) { notify('أدخل عنوان الاختبار', 'warning'); return; }
        const types = [...document.querySelectorAll('input[name="aie-qt"]:checked')].map(c => c.value);
        if (!types.length) { notify('اختر نوع سؤال على الأقل', 'warning'); return; }
        const cfg = getAICfg();
        if (!cfg.apiKey) { notify('أعد إعداد مفتاح AI', 'error'); return; }
        const fd = { title, description: document.getElementById('aie-dsc')?.value?.trim() || '', grade: document.getElementById('aie-grd')?.value || '', groupId: document.getElementById('aie-grp')?.value || '', difficulty: document.getElementById('aie-dif')?.value || 'medium', questionTypes: types, totalQuestions: parseInt(document.getElementById('aie-qn')?.value || 10), totalMarks: parseInt(document.getElementById('aie-mk')?.value || 50) };
        const gp = document.getElementById('aie-gp'), bar = document.getElementById('aie-pb'), txt = document.getElementById('aie-pt');
        if (gp) gp.style.display = 'block';
        let pct = 0; const iv = setInterval(() => { pct = Math.min(pct + 4, 82); if (bar) bar.style.width = pct + '%'; }, 250);
        try {
            if (txt) txt.textContent = 'يحلل المحتوى...';
            let material = document.getElementById('aie-mat')?.value?.trim() || '', img = null;
            if (window._aie_file) { if (window._aie_file.type === 'image') img = window._aie_file.base64; else material = window._aie_file.text; window._aie_file = null; }
            if (txt) txt.textContent = 'يولّد الأسئلة...';
            const questions = await genQs(fd, material, img);
            clearInterval(iv); if (bar) bar.style.width = '100%'; if (txt) txt.textContent = `✅ تم توليد ${questions.length} سؤال!`;
            setTimeout(() => renderEditor(fd, questions), 500);
        } catch (err) { clearInterval(iv); if (gp) gp.style.display = 'none'; notify('خطأ في AI: ' + err.message, 'error'); }
    }

    function renderEditor(fd, questions) {
        const w = document.getElementById('ai-exam-builder-section'); if (!w) return;
        _view = 'edit'; _draft = { fd, questions };
        const total = questions.reduce((a, q) => a + (q.marks || 0), 0);
        w.innerHTML = `<div class="aie-wrap">
<div class="aie-head">
  <div>
    <button class="aie-back" onclick="AIExamBuilder.renderCreate()"><i class="fas fa-arrow-right"></i> رجوع</button>
    <h1 class="aie-h1" style="margin-top:.5rem"><i class="fas fa-edit"></i> مراجعة وتعديل الأسئلة</h1>
    <p class="aie-sub">${fd.title} — ${questions.length} سؤال — مجموع: <strong>${total}</strong></p>
  </div>
  <div style="display:flex;gap:.8rem">
    <button class="aie-btn aie-ghost" onclick="AIExamBuilder.addQ()"><i class="fas fa-plus"></i> سؤال جديد</button>
    <button class="aie-btn aie-primary" onclick="AIExamBuilder.saveEditor()"><i class="fas fa-save"></i> حفظ ونشر</button>
  </div>
</div>
<div id="aie-ql">${questions.map((q, i) => buildQC(q, i)).join('')}</div>
<div style="display:flex;justify-content:flex-end;gap:1rem;margin-top:1.5rem">
  <button class="aie-btn aie-ghost" onclick="AIExamBuilder.addQ()"><i class="fas fa-plus"></i> سؤال جديد</button>
  <button class="aie-btn aie-primary" style="height:50px;padding:0 2rem" onclick="AIExamBuilder.saveEditor()"><i class="fas fa-save"></i> حفظ الاختبار ونشره</button>
</div>
</div>`;
        injectCSS();
    }

    function buildQC(q, idx) {
        const tc = { mcq: 'var(--primary)', tf: 'var(--accent)', fill: 'var(--warning)', essay: '#8b5cf6' };
        const tl = { mcq: 'اختيار متعدد', tf: 'صح/خطأ', fill: 'فراغ', essay: 'مقالي' };
        const c = tc[q.type] || 'var(--primary)';
        const opts = (q.options || []).map((opt, oi) => `<div style="display:flex;align-items:center;gap:.5rem;margin:.3rem 0">
<span style="width:23px;height:23px;border-radius:50%;background:${opt === q.answer ? 'var(--accent)' : '#e2e8f0'};color:${opt === q.answer ? '#fff' : '#64748b'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0">${['أ', 'ب', 'ج', 'د'][oi] || oi}</span>
<input class="aie-inp" style="flex:1;padding:.32rem .75rem;font-size:.83rem;margin:0" value="${opt.replace(/"/g, '&quot;')}" onchange="AIExamBuilder.updOpt(${idx},${oi},this.value)">
<button style="background:none;border:none;cursor:pointer;color:${opt === q.answer ? 'var(--accent)' : '#94a3b8'};font-size:.95rem;padding:.2rem .4rem;border-radius:6px" onclick="AIExamBuilder.setAns(${idx},'${opt.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',this)"><i class="fas fa-check-circle"></i></button>
</div>`).join('');
        return `<div class="aie-qc" id="aie-qc-${idx}">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
  <div style="display:flex;align-items:center;gap:.65rem">
    <div style="width:29px;height:29px;border-radius:50%;background:${c};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800">${idx + 1}</div>
    <span style="padding:.18rem .55rem;border-radius:99px;font-size:.7rem;font-weight:700;background:${c}20;color:${c}">${tl[q.type] || q.type}</span>
    <input type="number" style="width:50px;padding:.28rem .4rem;border:2px solid var(--border);border-radius:8px;font-size:.8rem;font-weight:700;text-align:center;font-family:inherit" value="${q.marks || 5}" min="1" onchange="AIExamBuilder.updQ(${idx},'marks',parseInt(this.value))">
    <span style="font-size:.76rem;color:var(--text-muted)">درجة</span>
  </div>
  <div style="display:flex;gap:.25rem">
    <button style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:.28rem;border-radius:6px;font-size:.88rem" onclick="AIExamBuilder.moveQ(${idx},-1)"><i class="fas fa-chevron-up"></i></button>
    <button style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:.28rem;border-radius:6px;font-size:.88rem" onclick="AIExamBuilder.moveQ(${idx},1)"><i class="fas fa-chevron-down"></i></button>
    <button style="background:none;border:none;cursor:pointer;color:var(--danger);padding:.28rem;border-radius:6px;font-size:.88rem" onclick="AIExamBuilder.delQ(${idx})"><i class="fas fa-trash"></i></button>
  </div>
</div>
<textarea class="aie-inp aie-ta" style="min-height:60px;font-size:.91rem" onchange="AIExamBuilder.updQ(${idx},'text',this.value)">${q.text}</textarea>
${q.options ? `<div style="margin-top:.65rem">${opts}</div>` : ''}
${!q.options ? `<div style="margin-top:.65rem"><label class="aie-lbl" style="font-size:.78rem">الإجابة الصحيحة</label><input class="aie-inp" style="margin-top:.28rem" value="${(q.answer || '').replace(/"/g, '&quot;')}" onchange="AIExamBuilder.updQ(${idx},'answer',this.value)"></div>` : ''}
${q.explanation ? `<p style="font-size:.76rem;color:var(--text-muted);margin-top:.45rem;padding:.4rem .65rem;background:var(--bg-light);border-radius:8px"><i class="fas fa-lightbulb"></i> ${q.explanation}</p>` : ''}
</div>`;
    }

    function updQ(idx, field, val) { if (_draft?.questions?.[idx]) _draft.questions[idx][field] = val; }
    function updOpt(qi, oi, val) { const q = _draft?.questions?.[qi]; if (!q?.options) return; if (q.answer === q.options[oi]) q.answer = val; q.options[oi] = val; }
    function setAns(qi, val, btn) { if (_draft?.questions?.[qi]) { _draft.questions[qi].answer = val; const card = document.getElementById(`aie-qc-${qi}`); card?.querySelectorAll("button[onclick*='setAns']").forEach(b => b.style.color = '#94a3b8'); btn.style.color = 'var(--accent)'; } }
    function moveQ(idx, dir) { const q = _draft?.questions; if (!q) return; const ni = idx + dir; if (ni < 0 || ni >= q.length) return; [q[idx], q[ni]] = [q[ni], q[idx]]; q.forEach((x, i) => x.order = i + 1); refreshQL(); }
    function delQ(idx) { if (!_draft?.questions) return; _draft.questions.splice(idx, 1); _draft.questions.forEach((q, i) => q.order = i + 1); refreshQL(); }
    function addQ(type) {
        if (!_draft) return;
        if (type) {
            _doAddQ(type);
        } else {
            let mp = document.getElementById('aie-type-picker');
            if (mp) { mp.remove(); return; }
            mp = document.createElement('div');
            mp.id = 'aie-type-picker';
            mp.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
            mp.innerHTML = `<div style="background:#fff;border-radius:18px;padding:1.8rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2)">
<h3 style="margin-bottom:1.2rem;font-weight:900;text-align:center"><i class="fas fa-plus-circle" style="color:var(--primary)"></i> اختر نوع السؤال</h3>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
  <button class="aie-type-opt" onclick="AIExamBuilder.addQ('mcq')" style="background:rgba(79,70,229,.07);border:2px solid rgba(79,70,229,.2);color:var(--primary)">
    <i class="fas fa-list-ul" style="font-size:1.5rem;display:block;margin-bottom:.4rem"></i>
    <strong>اختيار متعدد</strong><br><small style="opacity:.7">4 خيارات</small>
  </button>
  <button class="aie-type-opt" onclick="AIExamBuilder.addQ('tf')" style="background:rgba(16,185,129,.07);border:2px solid rgba(16,185,129,.2);color:var(--accent)">
    <i class="fas fa-check-double" style="font-size:1.5rem;display:block;margin-bottom:.4rem"></i>
    <strong>صح أو خطأ</strong><br><small style="opacity:.7">خيارين فقط</small>
  </button>
  <button class="aie-type-opt" onclick="AIExamBuilder.addQ('fill')" style="background:rgba(245,158,11,.07);border:2px solid rgba(245,158,11,.2);color:var(--warning)">
    <i class="fas fa-underline" style="font-size:1.5rem;display:block;margin-bottom:.4rem"></i>
    <strong>أكمل الفراغ</strong><br><small style="opacity:.7">إجابة نصية</small>
  </button>
  <button class="aie-type-opt" onclick="AIExamBuilder.addQ('essay')" style="background:rgba(139,92,246,.07);border:2px solid rgba(139,92,246,.2);color:#8b5cf6">
    <i class="fas fa-pen-alt" style="font-size:1.5rem;display:block;margin-bottom:.4rem"></i>
    <strong>مقالي</strong><br><small style="opacity:.7">إجابة تفصيلية</small>
  </button>
</div>
<button onclick="document.getElementById('aie-type-picker').remove()" style="width:100%;margin-top:1rem;padding:.65rem;border:2px solid var(--border);border-radius:10px;background:#fff;cursor:pointer;font-family:inherit;font-weight:700;color:var(--text-muted)">إلغاء</button>
</div>`;
            document.body.appendChild(mp);
            mp.addEventListener('click', e => { if (e.target === mp) mp.remove(); });
            if (!document.getElementById('aie-tp-css')) {
                const ts = document.createElement('style'); ts.id = 'aie-tp-css';
                ts.textContent = '.aie-type-opt{padding:1rem;border-radius:13px;cursor:pointer;font-family:inherit;font-size:.88rem;text-align:center;transition:transform .15s,box-shadow .15s}.aie-type-opt:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.1)}';
                document.head.appendChild(ts);
            }
        }
    }
    function _doAddQ(type) {
        if (!_draft.questions) _draft.questions = [];
        document.getElementById('aie-type-picker')?.remove();
        const defaults = {
            mcq: { options: ['الخيار أ', 'الخيار ب', 'الخيار ج', 'الخيار د'], answer: 'الخيار أ', marks: 5 },
            tf:  { options: ['صحيح', 'خطأ'], answer: 'صحيح', marks: 2 },
            fill: { answer: '', marks: 3 },
            essay: { answer: '', marks: 10 }
        };
        const d = defaults[type] || defaults.mcq;
        _draft.questions.push({ id: genId('q'), type, text: 'اكتب نص السؤال هنا...', ...d, order: _draft.questions.length + 1 });
        refreshQL();
        setTimeout(() => { const cs = document.querySelectorAll('.aie-qc'); cs[cs.length - 1]?.scrollIntoView({ behavior: 'smooth' }); }, 80);
    }
    function refreshQL() { const el = document.getElementById('aie-ql'); if (el && _draft?.questions) el.innerHTML = _draft.questions.map((q, i) => buildQC(q, i)).join(''); }

    async function saveEditor() {
        if (!_draft?.questions?.length) { notify('أضف سؤالاً على الأقل', 'warning'); return; }
        const { fd, questions } = _draft;
        const existing = _editId ? ((window.db && window.db.aiExams) || []).find(e => e.id === _editId) : null;
        const exam = { id: _editId || genId('exam'), title: fd.title, description: fd.description || '', grade: fd.grade || '', groupId: fd.groupId || '', difficulty: fd.difficulty || 'medium', questionTypes: fd.questionTypes || [], questions: questions.map((q, i) => ({ ...q, order: i + 1 })), totalMarks: questions.reduce((a, q) => a + (q.marks || 0), 0), status: 'active', examCode: existing?.examCode || genCode(), createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'admin', aiModel: getAICfg().model || 'gemini-1.5-flash' };
        await saveExam(exam); _editId = null; _draft = null;
        notify('✅ تم حفظ الاختبار ونشره!', 'success');
        renderList();
        setTimeout(() => genQR(exam.examCode, 'aie-qr-' + exam.id), 300);
    }

    function editExam(id) { const exam = ((window.db && window.db.aiExams) || []).find(e => e.id === id); if (!exam) return; _editId = id; renderEditor({ title: exam.title, description: exam.description, grade: exam.grade, groupId: exam.groupId, difficulty: exam.difficulty, questionTypes: exam.questionTypes || [], totalQuestions: exam.questions.length, totalMarks: exam.totalMarks }, JSON.parse(JSON.stringify(exam.questions))); }

    function startManual() {
        const title = document.getElementById('aie-ttl')?.value?.trim();
        if (!title) { notify('أدخل عنوان الاختبار أولاً', 'warning'); document.getElementById('aie-ttl')?.focus(); return; }
        const types = [...document.querySelectorAll('input[name="aie-qt"]:checked')].map(c => c.value);
        const fd = {
            title,
            description: document.getElementById('aie-dsc')?.value?.trim() || '',
            grade: document.getElementById('aie-grd')?.value || '',
            groupId: document.getElementById('aie-grp')?.value || '',
            difficulty: document.getElementById('aie-dif')?.value || 'medium',
            questionTypes: types.length ? types : ['mcq'],
            totalQuestions: 0,
            totalMarks: 0
        };
        renderEditor(fd, []);
        setTimeout(() => addQ(), 300);
    }

    function viewRes(examId) {
        const exam = ((window.db && window.db.aiExams) || []).find(e => e.id === examId); if (!exam) return;
        const w = document.getElementById('ai-exam-builder-section'); if (!w) return;
        const all = ((window.db && window.db.aiExamSessions) || []).filter(s => s.examId === examId);
        const done = all.filter(s => s.status === 'submitted').sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
        const avg = done.length ? Math.round(done.reduce((a, s) => a + (s.percentage || 0), 0) / done.length) : 0;
        const passed = done.filter(s => (s.percentage || 0) >= 50).length;
        w.innerHTML = `<div class="aie-wrap">
<div class="aie-head">
  <div>
    <button class="aie-back" onclick="AIExamBuilder.init()"><i class="fas fa-arrow-right"></i> رجوع</button>
    <h1 class="aie-h1" style="margin-top:.5rem"><i class="fas fa-chart-pie"></i> نتائج: ${exam.title}</h1>
    <p class="aie-sub">${done.length} طالب أتم الاختبار من ${all.length} جلسة</p>
  </div>
  <div style="display:flex;gap:.8rem">
    <button class="aie-btn aie-ghost" onclick="AIExamBuilder.printRes('${examId}')"><i class="fas fa-print"></i> طباعة التقرير</button>
    <button class="aie-btn aie-primary" onclick="AIExamBuilder.editExam('${examId}')"><i class="fas fa-edit"></i> تعديل</button>
  </div>
</div>
<div class="aie-stats">
  <div class="aie-sc" style="border-right:4px solid var(--primary)"><div class="aie-si" style="background:rgba(79,70,229,.1);color:var(--primary)"><i class="fas fa-chart-bar"></i></div><div><div class="aie-sn">${avg}%</div><div class="aie-sl">متوسط</div></div></div>
  <div class="aie-sc" style="border-right:4px solid var(--accent)"><div class="aie-si" style="background:rgba(16,185,129,.1);color:var(--accent)"><i class="fas fa-trophy"></i></div><div><div class="aie-sn">${passed}</div><div class="aie-sl">نجح</div></div></div>
  <div class="aie-sc" style="border-right:4px solid var(--danger)"><div class="aie-si" style="background:rgba(239,68,68,.1);color:var(--danger)"><i class="fas fa-times-circle"></i></div><div><div class="aie-sn">${done.length - passed}</div><div class="aie-sl">لم ينجح</div></div></div>
  <div class="aie-sc" style="border-right:4px solid var(--warning)"><div class="aie-si" style="background:rgba(245,158,11,.1);color:var(--warning)"><i class="fas fa-clock"></i></div><div><div class="aie-sn">${all.filter(s => s.status === 'in-progress').length}</div><div class="aie-sl">جاري</div></div></div>
</div>
<div class="aie-card">
  <div class="aie-card-hd">
    <h3 style="margin:0;font-weight:800"><i class="fas fa-list"></i> تفاصيل النتائج</h3>
    <input class="aie-srch" placeholder="بحث..." oninput="AIExamBuilder.filterRes(this.value,'${examId}')">
  </div>
  ${!done.length ? `<div style="padding:2rem;text-align:center;color:var(--text-muted)">لا توجد نتائج بعد</div>` : `
  <div style="overflow-x:auto"><table class="aie-tbl" id="aie-rtbl">
    <thead><tr><th>#</th><th>الطالب</th><th>الكود</th><th>الدرجة</th><th>النسبة%</th><th>الحالة</th><th>الوقت</th><th>انتهى في</th></tr></thead>
    <tbody>${done.map((s, i) => buildRR(s, i, exam)).join('')}</tbody>
  </table></div>`}
</div>
</div>`;
        injectCSS();
    }

    function buildRR(s, i, exam) {
        const p = s.percentage || 0, ok = p >= 50;
        return `<tr>
<td>${i + 1}</td><td><strong>${s.studentName || '—'}</strong></td>
<td><code style="background:var(--bg-light);padding:.18rem .45rem;border-radius:6px;font-size:.8rem">${s.studentCode || '—'}</code></td>
<td><strong>${s.score || 0}/${exam.totalMarks}</strong></td>
<td><div style="display:flex;align-items:center;gap:.45rem"><div style="width:65px;height:7px;background:#e2e8f0;border-radius:99px;overflow:hidden"><div style="width:${p}%;height:100%;background:${ok ? 'var(--accent)' : 'var(--danger)'};border-radius:99px"></div></div><span style="font-weight:800;color:${ok ? 'var(--accent)' : 'var(--danger)'}">${p}%</span></div></td>
<td><span style="padding:.18rem .55rem;border-radius:99px;font-size:.72rem;font-weight:700;background:${ok ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)'};color:${ok ? 'var(--accent)' : 'var(--danger)'}">${ok ? 'ناجح' : 'راسب'}</span></td>
<td>${fmt(s.timeTaken || 0)} د</td>
<td style="color:var(--text-muted);font-size:.76rem">${s.submitTime ? new Date(s.submitTime).toLocaleString('ar-EG') : '—'}</td>
</tr>`;
    }

    function filterRes(q, examId) {
        const exam = ((window.db && window.db.aiExams) || []).find(e => e.id === examId); if (!exam) return;
        const rows = ((window.db && window.db.aiExamSessions) || []).filter(s => s.examId === examId && s.status === 'submitted' && (s.studentName?.includes(q) || s.studentCode?.includes(q))).sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
        const tbody = document.querySelector('#aie-rtbl tbody'); if (tbody) tbody.innerHTML = rows.map((s, i) => buildRR(s, i, exam)).join('');
    }

    function printRes(examId) {
        const exam = ((window.db && window.db.aiExams) || []).find(e => e.id === examId); if (!exam) return;
        const done = ((window.db && window.db.aiExamSessions) || []).filter(s => s.examId === examId && s.status === 'submitted').sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
        const avg = done.length ? Math.round(done.reduce((a, s) => a + (s.percentage || 0), 0) / done.length) : 0;
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet"><style>body{font-family:Cairo,sans-serif;padding:15mm;font-size:11pt}h1{color:#4f46e5;text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:7px 10px;text-align:right}th{background:#f1f5f9;font-weight:700}.pass{color:#10b981;font-weight:700}.fail{color:#ef4444;font-weight:700}@media print{@page{margin:12mm}}</style></head><body><h1>تقرير نتائج الاختبار</h1><h2 style="text-align:center;color:#64748b">${exam.title}</h2><p style="text-align:center;color:#94a3b8">${new Date().toLocaleDateString('ar-EG')} — متوسط: ${avg}% — عدد الطلاب: ${done.length}</p><table><thead><tr><th>#</th><th>الطالب</th><th>الكود</th><th>الدرجة</th><th>النسبة%</th><th>الحالة</th></tr></thead><tbody>${done.map((s, i) => `<tr><td>${i + 1}</td><td>${s.studentName || '—'}</td><td>${s.studentCode || '—'}</td><td>${s.score || 0}/${exam.totalMarks}</td><td>${s.percentage || 0}%</td><td class="${(s.percentage || 0) >= 50 ? 'pass' : 'fail'}">${(s.percentage || 0) >= 50 ? 'ناجح' : 'راسب'}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);
        win.document.close();
    }

    function openCfg() {
        const cfg = getAICfg();
        let modal = document.getElementById('aie-modal'); if (modal) modal.remove();
        modal = document.createElement('div'); modal.id = 'aie-modal'; modal.className = 'modal-overlay'; modal.style.display = 'flex';
        modal.innerHTML = `<div class="modal-content" style="max-width:510px">
<h3 style="margin-bottom:1.5rem;text-align:center"><i class="fas fa-robot"></i> إعدادات الذكاء الاصطناعي</h3>
<div class="fg"><label class="aie-lbl">المزود</label><select id="aie-cp" class="aie-inp" onchange="AIExamBuilder.updMdls(this.value)"><option value="google" ${cfg.provider === 'google' ? 'selected' : ''}>Google Gemini</option><option value="openai" ${cfg.provider === 'openai' ? 'selected' : ''}>OpenAI GPT</option></select></div>
<div class="fg"><label class="aie-lbl">النموذج</label><select id="aie-cm" class="aie-inp">${(AI_PROVIDERS[cfg.provider] || AI_PROVIDERS.google).models.map(m => `<option value="${m}" ${m === cfg.model ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
<div class="fg"><label class="aie-lbl">مفتاح API *</label><div style="position:relative"><input type="password" id="aie-ck" class="aie-inp" value="${cfg.apiKey || ''}" placeholder="${cfg.provider === 'openai' ? 'sk-...' : 'AIza...'}" style="padding-left:2.5rem"><button type="button" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted)" onclick="const i=document.getElementById('aie-ck');i.type=i.type==='password'?'text':'password'"><i class="fas fa-eye"></i></button></div>
<p style="font-size:.74rem;color:var(--text-muted);margin-top:.3rem">${cfg.provider === 'openai' ? '<a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--primary)">platform.openai.com/api-keys</a>' : '<a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--primary)">aistudio.google.com</a> — مجاني وسريع'}</p></div>
<div class="aie-alert aie-info" style="margin-bottom:1rem"><i class="fas fa-shield-alt"></i> المفتاح يُحفظ على جهازك فقط ولا يُرسل لأي خادم آخر.</div>
<div style="display:flex;gap:.8rem">
  <button class="aie-btn aie-primary" style="flex:2" onclick="AIExamBuilder.saveCfg()"><i class="fas fa-save"></i> حفظ</button>
  <button class="aie-btn aie-ghost" onclick="AIExamBuilder.testKey()"><i class="fas fa-vial"></i> اختبار</button>
  <button class="aie-btn aie-ghost" onclick="document.getElementById('aie-modal').remove()">إغلاق</button>
</div>
<div id="aie-cst" style="display:none;margin-top:.8rem;padding:.65rem;border-radius:99px;font-size:.82rem;font-weight:700;text-align:center"></div>
</div>`;
        document.body.appendChild(modal); injectCSS();
    }
    function updMdls(p) { const s = document.getElementById('aie-cm'); if (s) s.innerHTML = (AI_PROVIDERS[p] || AI_PROVIDERS.google).models.map(m => `<option value="${m}">${m}</option>`).join(''); }
    function saveCfg() { const cfg = { provider: document.getElementById('aie-cp')?.value || 'google', model: document.getElementById('aie-cm')?.value || 'gemini-1.5-flash', apiKey: document.getElementById('aie-ck')?.value?.trim() || '' }; if (!cfg.apiKey) { notify('أدخل مفتاح API', 'warning'); return; } saveAICfg(cfg); notify('✅ تم حفظ إعدادات AI', 'success'); document.getElementById('aie-modal')?.remove(); if (_view === 'create') renderCreate(); }
    async function testKey() {
        const st = document.getElementById('aie-cst'); if (st) { st.style.display = 'block'; st.style.cssText += 'background:#f0f9ff;color:#0369a1'; st.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الاختبار...'; }
        const cfg = { provider: document.getElementById('aie-cp')?.value || 'google', model: document.getElementById('aie-cm')?.value || 'gemini-1.5-flash', apiKey: document.getElementById('aie-ck')?.value?.trim() || '' };
        if (!cfg.apiKey) { if (st) { st.style.cssText += 'background:#fef3c7;color:#92400e'; st.innerHTML = '⚠️ أدخل المفتاح'; } return; }
        const orig = getAICfg(); saveAICfg(cfg);
        try {
            await callAI('أجب بـ JSON فقط: {"ok":true}'); if (st) { st.style.cssText += 'background:#f0fdf4;color:#166534'; st.innerHTML = '✅ المفتاح يعمل!'; }
        }
        catch (err) { saveAICfg(orig); if (st) { st.style.cssText += 'background:#fef2f2;color:#991b1b'; st.innerHTML = '❌ ' + err.message; } }
    }

    function copyUrl(code) { const url = buildExamUrl(code); navigator.clipboard?.writeText(url).then(() => notify('✅ تم نسخ الرابط', 'success')).catch(() => { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); notify('✅ تم النسخ', 'success'); }); }

    function injectCSS() {
        if (document.getElementById('aie-css')) return;
        const s = document.createElement('style'); s.id = 'aie-css';
        s.textContent = `.aie-wrap{max-width:1180px;margin:0 auto}.aie-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2rem;flex-wrap:wrap;gap:1rem}.aie-h1{font-size:1.7rem;font-weight:900;color:var(--primary);margin:0}.aie-sub{color:var(--text-muted);margin-top:.3rem;font-size:.88rem}.aie-back{background:none;border:none;color:var(--primary);cursor:pointer;font-size:.87rem;font-weight:700;padding:0;font-family:inherit;display:flex;align-items:center;gap:.4rem}.aie-back:hover{opacity:.7}.aie-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem}.aie-sc{background:#fff;border-radius:15px;padding:1.1rem;display:flex;align-items:center;gap:.95rem;box-shadow:0 2px 9px rgba(0,0,0,.05);border:1px solid rgba(0,0,0,.04)}.aie-si{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0}.aie-sn{font-size:1.85rem;font-weight:900;color:var(--text-main);line-height:1}.aie-sl{font-size:.72rem;color:var(--text-muted);font-weight:600;margin-top:.18rem}.aie-card{background:#fff;border-radius:17px;padding:1.5rem;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:1.3rem;border:1px solid rgba(0,0,0,.04)}.aie-card-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;flex-wrap:wrap;gap:.65rem}.aie-ec{border:1px solid rgba(0,0,0,.06);border-radius:15px;padding:1.2rem;margin-bottom:.85rem;background:#fff;transition:box-shadow .2s}.aie-ec:hover{box-shadow:0 4px 16px rgba(79,70,229,.1)}.aie-btn{display:inline-flex;align-items:center;gap:.42rem;padding:.52rem 1.05rem;border-radius:11px;border:none;cursor:pointer;font-size:.87rem;font-weight:700;font-family:inherit;transition:all .2s}.aie-primary{background:var(--primary);color:#fff;box-shadow:0 4px 11px rgba(79,70,229,.2)}.aie-primary:hover{background:#3730a3;transform:translateY(-1px)}.aie-ghost{background:#fff;color:var(--text-main);border:1px solid var(--border)}.aie-ghost:hover{background:var(--bg-light)}.aie-sm{padding:.32rem .7rem;font-size:.76rem;border-radius:99px}.aie-link-btn{background:none;border:none;color:var(--primary);cursor:pointer;font-weight:700;font-size:inherit;font-family:inherit;text-decoration:underline}.fg{margin-bottom:.85rem}.aie-lbl{display:block;font-size:.82rem;font-weight:700;color:var(--text-main);margin-bottom:.32rem}.aie-inp{width:100%;padding:.63rem .92rem;border:2px solid var(--border);border-radius:10px;font-size:.88rem;font-family:inherit;color:var(--text-main);background:#fff;outline:none;transition:border-color .18s;box-sizing:border-box;margin-bottom:0}.aie-inp:focus{border-color:var(--primary)}.aie-ta{min-height:85px;resize:vertical}.aie-r3{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:.65rem}.aie-chk{display:flex;align-items:center;gap:.42rem;cursor:pointer;font-size:.83rem;font-weight:600;padding:.42rem .8rem;border:2px solid var(--border);border-radius:99px;transition:all .18s}.aie-chk:hover{border-color:var(--primary);background:rgba(79,70,229,.03)}.aie-stitle{font-size:.93rem;font-weight:800;color:var(--text-main);margin-bottom:.85rem;padding-bottom:.42rem;border-bottom:2px solid var(--border);display:flex;align-items:center;gap:.48rem}.aie-tabs{display:flex;gap:.32rem;margin-bottom:.85rem;background:var(--bg-light);padding:.22rem;border-radius:10px}.aie-tab{flex:1;padding:.42rem;border:none;background:none;border-radius:99px;cursor:pointer;font-size:.8rem;font-weight:700;font-family:inherit;color:var(--text-muted);transition:all .18s;display:flex;align-items:center;justify-content:center;gap:.37rem}.aie-tab.active{background:#fff;color:var(--primary);box-shadow:0 2px 7px rgba(0,0,0,.08)}.aie-drop{border:2px dashed var(--border);border-radius:13px;padding:1.7rem;text-align:center;transition:all .18s}.aie-over{border-color:var(--primary)!important;background:rgba(79,70,229,.04)}.aie-qc{background:#fff;border:1px solid var(--border);border-radius:13px;padding:1.15rem;margin-bottom:.85rem;transition:box-shadow .18s}.aie-qc:hover{box-shadow:0 3px 12px rgba(0,0,0,.07)}.aie-tbl{width:100%;border-collapse:collapse;font-size:.84rem}.aie-tbl th{background:var(--bg-light);padding:.72rem 1rem;text-align:right;font-weight:700;border-bottom:2px solid var(--border)}.aie-tbl td{padding:.72rem 1rem;border-bottom:1px solid var(--border)}.aie-tbl tr:hover td{background:rgba(79,70,229,.02)}.aie-srch{padding:.52rem .88rem;border:2px solid var(--border);border-radius:99px;font-size:.82rem;font-family:inherit;outline:none;min-width:185px}.aie-srch:focus{border-color:var(--primary)}.aie-alert{display:flex;align-items:center;gap:.58rem;padding:.75rem 1.05rem;border-radius:10px;font-size:.82rem;font-weight:600}.aie-warn{background:rgba(245,158,11,.08);color:#92400e;border:1px solid rgba(245,158,11,.2)}.aie-ok{background:rgba(16,185,129,.08);color:#065f46;border:1px solid rgba(16,185,129,.2)}.aie-info{background:rgba(14,165,233,.08);color:#075985;border:1px solid rgba(14,165,233,.2)}.aie-cgrid{display:grid;grid-template-columns:1fr 1fr;gap:1.3rem}@media(max-width:840px){.aie-cgrid{grid-template-columns:1fr}.aie-stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:540px){.aie-stats{grid-template-columns:1fr}.aie-head{flex-direction:column}}`;
        document.head.appendChild(s);
    }

    return {
        init, renderList, renderCreate, renderEditor, viewRes, editExam, startManual,
        delExam: (id) => delExam(id), toggleSt: (id) => toggleStatus(id),
        filterList, filterRes, swSrc, onDrop, onFile, startGen, saveEditor,
        addQ, delQ, moveQ, updQ, updOpt, setAns, copyUrl, _doAddQ,
        openCfg, saveCfg, testKey, updMdls, printRes, generateExamQR: genQR
    };
})();
