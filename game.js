/**
 * CLOUD UKO - "GAME" LAYER
 * ========================
 * All the moving, interactive parts of the dark neon theme (game.css).
 * No libraries: plain JavaScript, so there's nothing to install and it
 * stays light on mobile data.
 *
 * Features (each is its own function, called at the bottom):
 *   - Loading screen ("booting"), shown once per browser session
 *   - Particle background on a <canvas> that reacts to the mouse
 *   - XP bar: scroll progress shown as "LVL n - x% explored"
 *   - Achievements: small pop-ups for things like visiting 3 pages
 *   - Sound effects made with the Web Audio API (off until switched on)
 *   - Scroll reveals, "decoding" headings, counting-up stats
 *   - 3D tilt on cards, cursor glow, occasional title glitch
 *   - Mobile menu, skill buttons, and a secret code easter egg
 *   - Light / dark mode toggle (sun/moon button in the HUD)
 *   - Demos page: scrolling site previews, filters that hide empty groups
 *
 * Respecting visitors' devices:
 *   - prefers-reduced-motion: no loader, no particles, no tilt/glitch
 *   - touch screens: no tilt or cursor glow (they need a mouse)
 *   - fewer particles on small screens; animation pauses when the tab
 *     is hidden so it doesn't drain phone batteries
 *   - everything is wrapped so one failing effect never breaks the page
 */
(function () {
    'use strict';

    var root = document.documentElement;
    root.classList.remove('no-js');

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(pointer: fine)').matches;

    /* ---------- Small helpers ---------- */

    // localStorage can throw (private mode, blocked storage) - never let that break the page
    function store(key, value) {
        try {
            if (value === undefined) return localStorage.getItem(key);
            localStorage.setItem(key, value);
        } catch (e) { return null; }
    }

    function safe(name, fn) {
        try { fn(); } catch (e) { console.error('[game.js] ' + name + ' failed:', e); }
    }

    /* =========================================================
       THEME - light or dark, stored as data-theme on <html>.
       The first choice is made by a tiny script in each page's
       <head> (before anything is drawn, so there's no dark flash):
       the visitor's saved choice, else their device setting.
       ========================================================= */
    var Theme = {
        get: function () { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; },
        saved: function () { var t = store('cu_theme'); return t === 'light' || t === 'dark' ? t : null; },
        apply: function (t) {
            root.setAttribute('data-theme', t);
            // Phone browser bar colour follows the theme
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', t === 'light' ? '#f3f5fd' : '#05060f');
        }
    };
    // Safety net if a page is missing the <head> script
    if (!root.hasAttribute('data-theme')) {
        Theme.apply(Theme.saved() || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
    }

    /* =========================================================
       SOUND - tiny synthesised blips, no audio files to download.
       Off by default; the speaker button in the HUD toggles it and
       the choice is remembered.
       ========================================================= */
    var Sound = (function () {
        var ctx = null;
        var on = store('cu_sound') === 'on';

        function tone(freq, duration, type, volume, slideTo) {
            if (!on) return;
            try {
                ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = type || 'square';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
                gain.gain.setValueAtTime(volume || 0.04, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
                osc.connect(gain).connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration);
            } catch (e) { /* audio not available - stay silent */ }
        }

        return {
            isOn: function () { return on; },
            toggle: function () { on = !on; store('cu_sound', on ? 'on' : 'off'); if (on) this.click(); return on; },
            hover: function () { tone(880, 0.05, 'square', 0.015); },
            click: function () { tone(520, 0.09, 'square', 0.04, 1040); },
            levelUp: function () { tone(660, 0.12, 'triangle', 0.05, 1320); setTimeout(function () { tone(990, 0.16, 'triangle', 0.05, 1980); }, 110); },
            unlock: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.14, 'triangle', 0.05); }, i * 90); }); }
        };
    })();

    /* =========================================================
       ACHIEVEMENTS - each unlocks once per browser (localStorage)
       and shows a toast in the top-right. role="status" makes
       screen readers announce it politely.
       ========================================================= */
    var ACHIEVEMENTS = {
        joined:    { icon: '🎮', title: 'Player One Joined', desc: 'Welcome to Cloud UKO.' },
        explorer:  { icon: '🧭', title: 'Explorer', desc: 'Visited 3 different pages.' },
        shopper:   { icon: '🛒', title: 'Window Shopper', desc: 'Checked out the loadouts (pricing).' },
        tester:    { icon: '⚡', title: 'Beta Tester', desc: 'Launched a live demo.' },
        completed: { icon: '🏁', title: 'Completionist', desc: 'Reached the end of the page.' },
        skill:     { icon: '🧠', title: 'Skill Picked', desc: 'Chose a skill to talk about.' },
        story:     { icon: '📖', title: 'Story Mode', desc: 'Visited all five chapters.' },
        dayshift:  { icon: '☀️', title: 'Day Shift', desc: 'Switched on the lights.' },
        cheat:     { icon: '🕹️', title: 'Cheat Code Activated', desc: 'You found the secret. Respect.' }
    };

    var toastBox = null;

    function unlock(id) {
        var a = ACHIEVEMENTS[id];
        if (!a) return;
        var got = {};
        try { got = JSON.parse(store('cu_achievements') || '{}'); } catch (e) { got = {}; }
        if (got[id]) return;
        got[id] = Date.now();
        store('cu_achievements', JSON.stringify(got));

        if (!toastBox) {
            toastBox = document.createElement('div');
            toastBox.className = 'achievements';
            toastBox.setAttribute('role', 'status');
            toastBox.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastBox);
        }
        var el = document.createElement('div');
        el.className = 'achievement';
        // Built with textContent (not innerHTML) - safe even if the text changes later
        var icon = document.createElement('div'); icon.className = 'achievement-icon'; icon.textContent = a.icon;
        var body = document.createElement('div');
        var k = document.createElement('div'); k.className = 'achievement-kicker'; k.textContent = 'Achievement unlocked';
        var t = document.createElement('div'); t.className = 'achievement-title'; t.textContent = a.title;
        var d = document.createElement('div'); d.className = 'achievement-desc'; d.textContent = a.desc;
        body.append(k, t, d);
        el.append(icon, body);
        toastBox.appendChild(el);
        Sound.unlock();
        setTimeout(function () { el.remove(); }, 5000);
    }

    /* =========================================================
       LOADING SCREEN - a quick "boot" bar, once per session.
       Skipped for reduced motion; click/tap/any key skips it.
       ========================================================= */
    function loader(done) {
        var el = document.querySelector('.loader');
        var seen = false;
        try { seen = sessionStorage.getItem('cu_booted') === '1'; } catch (e) { /* ignore */ }

        if (!el || reduceMotion || seen) {
            if (el) el.remove();
            done();
            return;
        }

        var bar = el.querySelector('.loader-bar span');
        var label = el.querySelector('.loader-text');
        var steps = ['BOOTING SYSTEMS', 'LOADING LEVELS', 'CHARGING POWER-UPS', 'READY'];
        var pct = 0;
        var finished = false;

        function finish() {
            if (finished) return;
            finished = true;
            try { sessionStorage.setItem('cu_booted', '1'); } catch (e) { /* ignore */ }
            el.classList.add('done');
            setTimeout(function () { el.remove(); }, 600);
            done();
        }

        var timer = setInterval(function () {
            pct = Math.min(100, pct + 6 + Math.random() * 14);
            bar.style.width = pct + '%';
            // Last step ("READY") only shows at 100%
            label.textContent = (pct >= 100 ? steps[steps.length - 1] : steps[Math.min(steps.length - 2, Math.floor(pct / 34))]) + ' ' + Math.floor(pct) + '%';
            if (pct >= 100) { clearInterval(timer); setTimeout(finish, 250); }
        }, 90);

        ['click', 'keydown', 'touchstart'].forEach(function (evt) {
            el.addEventListener(evt, function () { clearInterval(timer); finish(); }, { once: true, passive: true });
        });
        document.addEventListener('keydown', function () { clearInterval(timer); finish(); }, { once: true });
    }

    /* =========================================================
       PARTICLES - neon dots drifting upward; dots near each other
       (or near the mouse) are joined by faint lines.
       ========================================================= */
    function particles() {
        var canvas = document.getElementById('fx-canvas');
        if (!canvas || reduceMotion) { if (canvas) canvas.remove(); return; }
        var ctx = canvas.getContext('2d');
        // Logo colours as "r,g,b"; light mode uses deeper shades of the same five
        // so the dots still show on a white background. Read every frame, so
        // switching theme recolours the dots immediately.
        var PALETTES = {
            dark:  ['34,211,238', '45,212,191', '59,130,246', '139,92,246', '200,78,240'],
            light: ['14,116,144', '15,118,110', '29,78,216', '109,40,217', '162,28,175']
        };
        var dots = [];
        var mouse = { x: -9999, y: -9999 };
        var w, h, dpr, running = true;

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2); // cap for performance on high-DPI phones
            w = canvas.clientWidth;
            h = canvas.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            // Roughly one dot per 18,000px² - about 30 on a phone, 70-90 on desktop
            var target = Math.max(24, Math.min(90, Math.round((w * h) / 18000)));
            while (dots.length < target) dots.push(newDot(true));
            dots.length = target;
        }

        function newDot(anywhere) {
            return {
                x: Math.random() * w,
                y: anywhere ? Math.random() * h : h + 10,
                r: Math.random() * 1.8 + 0.6,
                vx: (Math.random() - 0.5) * 0.25,
                vy: -(Math.random() * 0.35 + 0.08),
                ci: Math.floor(Math.random() * PALETTES.dark.length),
                a: Math.random() * 0.5 + 0.35
            };
        }

        function frame() {
            if (!running) return;
            ctx.clearRect(0, 0, w, h);
            var light = Theme.get() === 'light';
            var colours = light ? PALETTES.light : PALETTES.dark;
            var glow = light ? 0 : 8; // a neon glow looks muddy on white
            for (var i = 0; i < dots.length; i++) {
                var p = dots[i];
                p.c = colours[p.ci];
                // Gentle push away from the mouse
                var dx = p.x - mouse.x, dy = p.y - mouse.y, dist2 = dx * dx + dy * dy;
                if (dist2 < 14000) { p.x += dx * 0.012; p.y += dy * 0.012; }
                p.x += p.vx;
                p.y += p.vy;
                if (p.y < -10 || p.x < -10 || p.x > w + 10) { dots[i] = p = newDot(false); p.c = colours[p.ci]; }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + p.c + ',' + p.a + ')';
                ctx.shadowBlur = glow;
                ctx.shadowColor = 'rgba(' + p.c + ',0.9)';
                ctx.fill();

                // Lines to nearby dots (only check later dots so each pair is drawn once)
                for (var j = i + 1; j < dots.length; j++) {
                    var q = dots[j];
                    var ex = p.x - q.x, ey = p.y - q.y, d2 = ex * ex + ey * ey;
                    if (d2 < 9000) {
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = 'rgba(' + p.c + ',' + (0.14 * (1 - d2 / 9000)) + ')';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.stroke();
                    }
                }
            }
            ctx.shadowBlur = 0;
            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', resize, { passive: true });
        window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
        window.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });
        // Pause when the tab isn't visible (saves battery)
        document.addEventListener('visibilitychange', function () {
            running = !document.hidden;
            if (running) requestAnimationFrame(frame);
        });

        resize();
        requestAnimationFrame(frame);
    }

    /* =========================================================
       XP BAR - scroll progress. Every 25% is a "level"; crossing
       one flashes the bar and plays a level-up sound.
       ========================================================= */
    function xpBar() {
        var xp = document.querySelector('.xp');
        if (!xp) return;
        var fill = xp.querySelector('.xp-fill');
        var label = xp.querySelector('.xp-label');
        var lastLevel = 1;
        var ticking = false;
        var ch = document.body.dataset.chapter;
        var chapterPrefix = ch ? (isNaN(ch) ? ch.toUpperCase() : 'CH ' + ch) + ' · ' : '';

        function update() {
            ticking = false;
            var max = document.documentElement.scrollHeight - window.innerHeight;
            var pct = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100;
            var level = Math.min(5, 1 + Math.floor(pct / 25));
            fill.style.width = pct + '%';
            // Chapter pages prefix the label, e.g. "CH 3 · LVL 2 · 40% EXPLORED"
            label.textContent = chapterPrefix + 'LVL ' + level + ' · ' + pct + '% EXPLORED';
            if (level > lastLevel) {
                xp.classList.remove('level-up');
                void xp.offsetWidth; // restart the CSS animation
                xp.classList.add('level-up');
                Sound.levelUp();
            }
            lastLevel = level;
            if (pct >= 98) unlock('completed');
        }

        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    /* =========================================================
       SCROLL REVEALS + "decoding" headings + counters + charge bars
       ========================================================= */
    var GLYPHS = '!<>-_\\/[]{}=+*^?#01';

    // Scrambles the text into random symbols, then resolves it letter by letter
    function decode(el) {
        if (reduceMotion || el.dataset.decoded) return;
        el.dataset.decoded = '1';
        var finalText = el.textContent;
        var frame = 0;
        var total = Math.min(40, finalText.length * 2 + 10);
        (function step() {
            var out = '';
            for (var i = 0; i < finalText.length; i++) {
                var ch = finalText[i];
                if (ch === ' ' || frame / total > i / finalText.length) out += ch;
                else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            }
            el.textContent = out;
            if (frame++ < total) requestAnimationFrame(step);
            else el.textContent = finalText;
        })();
    }

    // Counts a number up from 0 (keeps text like "1:1" or "100%" formatting)
    function countUp(el) {
        var target = parseInt(el.dataset.count, 10);
        if (isNaN(target) || reduceMotion) return;
        var suffix = el.dataset.suffix || '';
        var start = target > 1000 ? target - 60 : 0; // years count up the last stretch only
        var t0 = null;
        (function step(ts) {
            if (!t0) t0 = ts;
            var p = Math.min(1, (ts - t0) / 1400);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(start + (target - start) * eased) + suffix;
            if (p < 1) requestAnimationFrame(step);
        })(performance.now());
    }

    function reveals() {
        var items = document.querySelectorAll('.reveal');
        if (!('IntersectionObserver' in window)) {
            items.forEach(function (el) { el.classList.add('in'); });
            return;
        }
        // Stagger siblings inside the same group
        document.querySelectorAll('[data-stagger]').forEach(function (group) {
            group.querySelectorAll('.reveal').forEach(function (el, i) { el.style.setProperty('--d', (i * 0.08) + 's'); });
        });

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el = entry.target;
                el.classList.add('in');
                el.querySelectorAll('[data-decode]').forEach(decode);
                if (el.matches('[data-decode]')) decode(el);
                el.querySelectorAll('[data-count]').forEach(countUp);
                if (el.dataset.unlock) unlock(el.dataset.unlock);
                io.unobserve(el);
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        items.forEach(function (el) { io.observe(el); });
    }

    /* =========================================================
       TILT - cards lean towards the mouse in 3D (mouse only)
       ========================================================= */
    function tilt() {
        if (!finePointer || reduceMotion) return;
        document.querySelectorAll('[data-tilt]').forEach(function (card) {
            var max = 7; // degrees
            card.addEventListener('pointermove', function (e) {
                var r = card.getBoundingClientRect();
                var x = (e.clientX - r.left) / r.width - 0.5;
                var y = (e.clientY - r.top) / r.height - 0.5;
                card.style.transform = 'perspective(900px) rotateY(' + (x * max) + 'deg) rotateX(' + (-y * max) + 'deg) translateY(-4px)';
            });
            card.addEventListener('pointerleave', function () { card.style.transform = ''; });
            card.addEventListener('pointerenter', function () { Sound.hover(); });
        });
    }

    /* =========================================================
       CURSOR GLOW + MAGNETIC BUTTONS (mouse only)
       ========================================================= */
    function cursorGlow() {
        if (!finePointer || reduceMotion) return;
        var glow = document.createElement('div');
        glow.className = 'cursor-glow';
        glow.setAttribute('aria-hidden', 'true');
        document.body.appendChild(glow);
        var x = 0, y = 0, gx = 0, gy = 0;
        window.addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; }, { passive: true });
        (function follow() {
            // Ease towards the pointer so the light trails slightly behind
            gx += (x - gx) * 0.12;
            gy += (y - gy) * 0.12;
            glow.style.transform = 'translate3d(' + gx + 'px,' + gy + 'px,0)';
            requestAnimationFrame(follow);
        })();

        // Buttons drift a few pixels towards the cursor
        document.querySelectorAll('.btn').forEach(function (btn) {
            btn.addEventListener('pointermove', function (e) {
                var r = btn.getBoundingClientRect();
                var mx = (e.clientX - r.left - r.width / 2) * 0.15;
                var my = (e.clientY - r.top - r.height / 2) * 0.25;
                btn.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
            });
            btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
        });
    }

    /* =========================================================
       TITLE GLITCH - a short jolt every few seconds
       ========================================================= */
    function glitch() {
        if (reduceMotion) return;
        // The wrapper glitches, not the h1 - the h1's animation is the lava flow
        var title = document.querySelector('.glitch-wrap');
        if (!title) return;
        setInterval(function () {
            if (document.hidden) return;
            title.classList.remove('glitch');
            void title.offsetWidth;
            title.classList.add('glitch');
        }, 4200);
    }

    /* =========================================================
       HUD - mobile menu, sound toggle, click sounds
       ========================================================= */
    function hud() {
        var burger = document.querySelector('.hud-burger');
        var menu = document.getElementById('hud-mobile');
        if (burger && menu) {
            burger.addEventListener('click', function () {
                var open = burger.getAttribute('aria-expanded') !== 'true';
                burger.setAttribute('aria-expanded', String(open));
                menu.classList.toggle('open', open);
                Sound.click();
            });
        }

        var soundBtn = document.querySelector('.sound-toggle');
        if (soundBtn) {
            // Speaker icon: sound waves when on, a cross when muted
            var SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/>';
            var WAVES = '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
            var MUTED = '<path d="m16 9 5 6"/><path d="m21 9-5 6"/></svg>';
            var paint = function () {
                var on = Sound.isOn();
                soundBtn.setAttribute('aria-pressed', String(on));
                soundBtn.innerHTML = SPEAKER + (on ? WAVES : MUTED);
                soundBtn.setAttribute('aria-label', on ? 'Turn sound effects off' : 'Turn sound effects on');
            }
            soundBtn.addEventListener('click', function () { Sound.toggle(); paint(); });
            paint();
        }

        document.querySelectorAll('.btn, .skill, .hud-links a').forEach(function (el) {
            el.addEventListener('click', function () { Sound.click(); });
        });
    }

    /* =========================================================
       THEME TOGGLE - sun/moon button in the HUD. The new theme
       spreads out in a circle from the button where the browser
       supports View Transitions; elsewhere colours fade across.
       ========================================================= */
    function themeToggle() {
        var btn = document.querySelector('.theme-toggle');
        var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
        var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

        // The icon shows what you'll switch TO
        function paint() {
            if (!btn) return;
            var light = Theme.get() === 'light';
            btn.innerHTML = light ? MOON : SUN;
            btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
        }

        function switchTo(next) {
            var change = function () { Theme.apply(next); paint(); };
            if (reduceMotion) { change(); return; }
            if (document.startViewTransition) {
                var r = btn.getBoundingClientRect();
                var x = r.left + r.width / 2, y = r.top + r.height / 2;
                var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
                var vt = document.startViewTransition(change);
                vt.ready.then(function () {
                    root.animate(
                        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
                        { duration: 650, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
                    );
                }).catch(function () { /* transition skipped - theme still changed */ });
            } else {
                root.classList.add('theme-fade');
                change();
                setTimeout(function () { root.classList.remove('theme-fade'); }, 450);
            }
        }

        if (btn) {
            btn.addEventListener('click', function () {
                var next = Theme.get() === 'light' ? 'dark' : 'light';
                store('cu_theme', next);
                btn.classList.toggle('spin');
                switchTo(next);
                Sound.click();
                if (next === 'light') unlock('dayshift');
            });
        }
        paint();

        // No saved choice yet? Keep following the device if it switches (e.g. at sunset)
        var mq = window.matchMedia('(prefers-color-scheme: light)');
        var follow = function (e) { if (!Theme.saved()) { Theme.apply(e.matches ? 'light' : 'dark'); paint(); } };
        if (mq.addEventListener) mq.addEventListener('change', follow);
    }

    /* =========================================================
       SCROLLING PREVIEWS (demos page) - a cabinet's screen img can
       carry data-full: a tall capture of the whole site. On hover
       (mouse) or while the cabinet is mid-screen (touch), the tall
       image is loaded - only then, to save mobile data - and the
       CSS pans it from the top of the site to the bottom.
       ========================================================= */
    function previews() {
        if (reduceMotion) return;
        document.querySelectorAll('.cab-screen').forEach(function (screen) {
            var img = screen.querySelector('img[data-full]');
            if (!img) return;
            var loaded = false, waiting = null, want = false;

            function load(cb) {
                if (loaded) { cb(); return; }
                if (waiting) { waiting.push(cb); return; }
                waiting = [cb];
                var full = new Image();
                full.onload = function () {
                    img.src = full.src; // same top as the small screenshot, so the swap is invisible
                    loaded = true;
                    waiting.forEach(function (f) { f(); });
                };
                full.onerror = function () { waiting = null; }; // keep the small screenshot
                full.src = img.dataset.full;
            }

            function start() {
                want = true;
                load(function () {
                    if (!want) return;
                    // Travel at roughly 110px a second, between 5 and 14 seconds
                    var travel = img.clientWidth * (img.naturalHeight / img.naturalWidth) - img.clientHeight;
                    screen.style.setProperty('--preview-dur', Math.max(5, Math.min(14, travel / 110)).toFixed(1) + 's');
                    // Two frames so the browser has laid out the tall image before panning starts
                    requestAnimationFrame(function () { requestAnimationFrame(function () { if (want) screen.classList.add('previewing'); }); });
                });
            }
            function stop() { want = false; screen.classList.remove('previewing'); }

            var cab = screen.closest('.cabinet') || screen;
            if (finePointer) {
                cab.addEventListener('pointerenter', start);
                cab.addEventListener('pointerleave', stop);
                cab.addEventListener('focusin', start);
                cab.addEventListener('focusout', function (e) { if (!cab.contains(e.relatedTarget)) stop(); });
            } else if ('IntersectionObserver' in window) {
                // Touch: play while the screen is in the middle third of the viewport
                new IntersectionObserver(function (entries) {
                    entries.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
                }, { rootMargin: '-33% 0px -33% 0px' }).observe(screen);
            }
        });
    }

    /* =========================================================
       PAGE-LEVEL TRACKING for achievements
       ========================================================= */
    function tracking() {
        // Explorer: count distinct pages visited (stored as a small list of paths)
        var pages = [];
        try { pages = JSON.parse(store('cu_pages') || '[]'); } catch (e) { pages = []; }
        var here = location.pathname.split('/').pop() || 'index.html';
        if (pages.indexOf(here) === -1) { pages.push(here); store('cu_pages', JSON.stringify(pages.slice(-20))); }
        if (pages.length >= 3) setTimeout(function () { unlock('explorer'); }, 1500);

        // Beta Tester: any link marked as a demo
        document.querySelectorAll('[data-demo-link]').forEach(function (a) {
            a.addEventListener('click', function () { unlock('tester'); });
        });

        // Skill buttons go to the contact form with the service prefilled (existing behaviour)
        document.querySelectorAll('.skill[data-service]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                unlock('skill');
                var service = btn.getAttribute('data-service');
                // Small delay so the achievement sound/toast is noticed before navigating
                setTimeout(function () { window.location.href = 'contact.html?service=' + encodeURIComponent(service); }, 350);
            });
        });
    }

    /* =========================================================
       CHAPTERS
       Each inner page's <body> carries:
         data-chapter="3"                 (or e.g. "Side quest")
         data-chapter-name="Quest Log"    big title on the card
         data-chapter-sub="Projects"      small line under it
         data-page="projects"             id used by the chapter map
       ========================================================= */
    var CHAPTER_PAGES = ['about', 'service', 'projects', 'demos', 'contact'];

    function visitedChapters() {
        try { return JSON.parse(store('cu_chapters') || '[]'); } catch (e) { return []; }
    }

    // Title card when a chapter opens - once per page per session, and
    // never on top of the boot loader (first visit) or for reduced motion.
    function chapterCard(bootShowing) {
        var b = document.body;
        var name = b.dataset.chapterName;
        if (!name || reduceMotion || bootShowing) return;
        var key = 'cu_ch_seen_' + (b.dataset.page || name);
        try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) { /* ignore */ }

        var ch = b.dataset.chapter || '';
        var card = document.createElement('div');
        card.className = 'chapter-card';
        card.setAttribute('aria-hidden', 'true');
        var inner = document.createElement('div'); inner.className = 'chapter-card-inner';
        var num = document.createElement('div'); num.className = 'chapter-num';
        num.textContent = isNaN(ch) ? ch.toUpperCase() : 'CHAPTER ' + ('0' + ch).slice(-2);
        var title = document.createElement('div'); title.className = 'chapter-name'; title.textContent = name;
        var line = document.createElement('div'); line.className = 'chapter-line';
        var sub = document.createElement('div'); sub.className = 'chapter-sub'; sub.textContent = b.dataset.chapterSub || '';
        inner.append(num, title, line, sub);
        card.appendChild(inner);
        document.body.appendChild(card);
        Sound.levelUp();
        var gone = function () { card.remove(); };
        card.addEventListener('click', gone);
        card.addEventListener('animationend', function (e) { if (e.animationName === 'chapterOut') gone(); });
        setTimeout(gone, 2600); // safety net
    }

    // Chapter map dots: mark visited chapters + the current one,
    // and unlock "Story Mode" once all five have been visited.
    function chapterMap() {
        var page = document.body.dataset.page;
        var seen = visitedChapters();
        if (page && CHAPTER_PAGES.indexOf(page) !== -1 && seen.indexOf(page) === -1) {
            seen.push(page);
            store('cu_chapters', JSON.stringify(seen));
        }
        document.querySelectorAll('.chapter-map a[data-page]').forEach(function (a) {
            if (a.dataset.page === page) { a.classList.add('current'); a.setAttribute('aria-current', 'page'); }
            else if (seen.indexOf(a.dataset.page) !== -1) a.classList.add('visited');
        });
        if (CHAPTER_PAGES.every(function (p) { return seen.indexOf(p) !== -1; })) {
            setTimeout(function () { unlock('story'); }, 2200);
        }
    }

    // Page-turn wipe: when following a link to another page on this site,
    // cover the screen first, then navigate. New tabs, downloads, in-page
    // anchors and modified clicks (Ctrl/Cmd/Shift) are left alone.
    function pageWipe() {
        if (reduceMotion) return;
        var wipe = document.createElement('div');
        wipe.className = 'page-wipe';
        wipe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(wipe);

        document.addEventListener('click', function (e) {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            var a = e.target.closest('a[href]');
            if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
            var url;
            try { url = new URL(a.href, location.href); } catch (err) { return; }
            if (url.origin !== location.origin || url.protocol.indexOf('http') !== 0 && url.protocol !== 'file:') return;
            if (url.pathname === location.pathname && url.hash) return; // same-page anchor
            if (!/\.html$|\/$/.test(url.pathname)) return;
            e.preventDefault();
            wipe.classList.add('on');
            setTimeout(function () { location.href = url.href; }, 380);
        });

        // Coming back with the browser's Back button can restore the page
        // from memory with the wipe still covering it - clear it.
        window.addEventListener('pageshow', function () { wipe.classList.remove('on'); });
    }

    // Filters (projects + demos): buttons with data-filter show matching
    // [data-category] cards. A [data-filter-group] (heading + its grid) is
    // hidden when the filter leaves it with no cards.
    function filters() {
        var buttons = document.querySelectorAll('.filter[data-filter]');
        if (!buttons.length) return;
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var f = btn.dataset.filter;
                buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
                document.querySelectorAll('[data-category]').forEach(function (card) {
                    var show = f === 'all' || card.dataset.category === f;
                    card.hidden = !show;
                    if (show) card.classList.add('in'); // make sure revealed cards are visible
                });
                document.querySelectorAll('[data-filter-group]').forEach(function (group) {
                    group.hidden = !group.querySelector('[data-category]:not([hidden])');
                    if (!group.hidden) group.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
                });
                Sound.click();
            });
        });
    }

    /* =========================================================
       SECRET CODE - up up down down left right left right B A
       ========================================================= */
    function cheatCode() {
        var code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        var pos = 0;
        document.addEventListener('keydown', function (e) {
            var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            pos = key === code[pos] ? pos + 1 : (key === code[0] ? 1 : 0);
            if (pos === code.length) {
                pos = 0;
                unlock('cheat');
                confetti();
            }
        });
    }

    function confetti() {
        if (reduceMotion) return;
        var colours = ['#22d3ee', '#2dd4bf', '#3b82f6', '#8b5cf6', '#c84ef0', '#fbbf24'];
        for (var i = 0; i < 80; i++) {
            var c = document.createElement('div');
            c.className = 'confetti';
            c.style.left = Math.random() * 100 + 'vw';
            c.style.background = colours[i % colours.length];
            c.style.animationDuration = (2 + Math.random() * 2) + 's';
            c.style.animationDelay = (Math.random() * 0.6) + 's';
            document.body.appendChild(c);
            setTimeout(c.remove.bind(c), 5000);
        }
    }

    /* ---------- Start everything ---------- */
    function start() {
        safe('hud', hud);
        safe('themeToggle', themeToggle);
        safe('particles', particles);
        safe('previews', previews);
        safe('xpBar', xpBar);
        safe('reveals', reveals);
        safe('tilt', tilt);
        safe('cursorGlow', cursorGlow);
        safe('glitch', glitch);
        safe('tracking', tracking);
        safe('cheatCode', cheatCode);
        safe('filters', filters);
        safe('chapterMap', chapterMap);
        safe('pageWipe', pageWipe);
        // Boot loader shows on the first page of a visit; otherwise this
        // page's chapter card plays (never both at once).
        var bootShowing = false;
        try { bootShowing = !!document.querySelector('.loader') && !reduceMotion && sessionStorage.getItem('cu_booted') !== '1'; } catch (e) { /* ignore */ }
        safe('chapterCard', function () { chapterCard(bootShowing); });
        safe('loader', function () {
            loader(function () { setTimeout(function () { unlock('joined'); }, 900); });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
