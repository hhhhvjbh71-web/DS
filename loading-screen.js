/* ═══════════════════════════════════════════════════════════════════
   loading-screen.js — منصة الدكتور إسلام عبد الواحد
   Full-screen Cinematic Biology Loading Screen (Phase 1 — v2)
   ───────────────────────────────────────────────────────────────────
   - Plays a staged entrance (dark → hero media emerges → name → progress)
   - Upgrades the full-screen fallback image to the generated cell video
     the moment ./cell-video.(webm|mp4) exists. Until then
     this is a safe no-op and the Ken-Burns image stays as the hero.
   - Hides itself once the platform is ready: fades the name/progress
     out first, then the video, then removes the loader — never a hard
     cut, never blocks the platform indefinitely.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var loader = document.getElementById('cellLoader');
  if (!loader) return;

  var bar   = document.getElementById('clFill');
  var msg   = document.getElementById('clMsg');
  var media = document.getElementById('clMedia');

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ── Staged entrance ──────────────────────────────────────────── */
  setTimeout(function () { loader.classList.add('cl-stage-cell'); }, 150);
  setTimeout(function () { loader.classList.add('cl-stage-brand'); }, 1000);
  setTimeout(function () { loader.classList.add('cl-stage-progress'); }, 1400);

  /* ── Progress messages ───────────────────────────────────────── */
  var msgs = [
    'نجهّز عالم الأحياء…',
    'ندخل إلى الخلية…',
    'نرتّب المفاهيم…',
    'نجهّز الدروس…',
    'كل شيء جاهز.'
  ];
  var pcts = [15, 32, 54, 76, 96];
  var i = 0;

  function step(crossfade) {
    if (i >= msgs.length) return;
    if (bar) bar.style.width = pcts[i] + '%';
    if (msg) {
      if (crossfade) {
        msg.classList.remove('cl-msg-in');
        (function (text) {
          setTimeout(function () {
            msg.textContent = text;
            msg.classList.add('cl-msg-in');
          }, 200);
        })(msgs[i]);
      } else {
        msg.textContent = msgs[i];
      }
    }
    i++;
  }

  step(false);
  setTimeout(function () { if (msg) msg.classList.add('cl-msg-in'); }, 1500);
  setTimeout(function () { step(true); }, 1700);
  setTimeout(function () { step(true); }, 2900);
  setTimeout(function () { step(true); }, 4100);
  setTimeout(function () { step(true); }, 5200);

  /* ── Video upgrade: full-screen hero, not a small clip ───────────
     Looks for ./cell-video.webm / .mp4. If neither
     exists yet (default state today), this is a silent no-op and the
     Ken-Burns full-screen image stays as the hero — the platform is
     never blocked or slowed down by a missing file. ───────────────── */
  function tryVideoUpgrade() {
    if (reduceMotion || !media || typeof document.createElement !== 'function') return;

    var video = document.createElement('video');
    video.className = 'cl-video';
    video.muted = true;
    video.setAttribute('muted', '');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.loop = true;
    video.autoplay = true;
    video.preload = 'auto';

    var settled = false;
    function settle(useVideo) {
      if (settled) return;
      settled = true;
      if (useVideo) {
        media.appendChild(video);
        media.classList.add('cl-has-video');
        var playAttempt = video.play();
        if (playAttempt && typeof playAttempt.catch === 'function') {
          playAttempt.catch(function () {
            media.classList.remove('cl-has-video');
            if (video.parentNode) video.parentNode.removeChild(video);
          });
        }
      }
    }

    video.addEventListener('loadeddata', function () { settle(true); });
    video.addEventListener('error', function () { settle(false); });

    var srcWebm = document.createElement('source');
    srcWebm.src = './cell-video.webm';
    srcWebm.type = 'video/webm';
    var srcMp4 = document.createElement('source');
    srcMp4.src = './cell-video.mp4';
    srcMp4.type = 'video/mp4';
    video.appendChild(srcWebm);
    video.appendChild(srcMp4);

    // Safety: if neither source resolves quickly, just keep the image.
    setTimeout(function () { settle(false); }, 1500);
  }
  tryVideoUpgrade();

  /* ── Hide once the platform is ready ─────────────────────────────
     Sequenced exit: fade the name/progress first, then the hero
     media, then remove the loader — matching a real cinematic outro
     rather than a hard cut. The video (if active) keeps playing
     naturally the whole time; it is never paused mid-fade. ────────── */
  function hide() {
    if (!loader || !loader.parentNode) return;
    if (bar) bar.style.width = '100%';
    setTimeout(function () {
      loader.classList.add('cl-exit-text');       // 1) name + progress fade out
      setTimeout(function () {
        loader.classList.add('cl-hide');          // 2) hero video/image fades out
        if (typeof window.startHeroTypewriter === 'function') {
          setTimeout(window.startHeroTypewriter, 300);
        }
        setTimeout(function () {
          if (loader.parentNode) loader.parentNode.removeChild(loader); // 3) reveal platform
        }, 1000);
      }, 450);
    }, 250);
  }

  var minAt = Date.now() + 6300;
  function tryHide() {
    var delay = Math.max(0, minAt - Date.now());
    setTimeout(hide, delay);
  }

  if (document.readyState === 'complete') {
    tryHide();
  } else {
    window.addEventListener('load', tryHide);
  }

  // Hard safety cap — never leave the loader on screen forever.
  setTimeout(function () {
    if (loader && loader.parentNode) hide();
  }, 13000);
})();
