/**
 * CLOUD UKO - REALISM LAYER
 * =========================
 * Physics on top of the game theme. Load BEFORE game.js: game.js sees
 * window.CURealism and hands over its tilt, magnetic buttons and page wipe.
 * If this file is missing or the visitor asks for reduced motion,
 * CURealism stays undefined and game.js keeps its own simpler versions.
 *
 *   - Fluid: a real-time Navier-Stokes simulation in the logo colours
 *     (hand-written WebGL2, no libraries) that the cursor/finger stirs
 *   - Springs: buttons and cards have mass - they compress, overshoot, settle
 *   - Press: every click sends a burst through the fluid + a shockwave ring
 *   - Glass: panels catch a moving light, with a bright edge near the cursor
 *   - Depth: background layers shift with the pointer, scroll and phone tilt
 *   - Scrolling pushes the fluid, and a liquid page wipe
 *
 * Performance: the fluid picks a quality level from the device, drops a level
 * if frames get slow, and switches itself off if even the lowest is too slow
 * (the particle background carries on). ?fx=force turns that off for testing.
 */
(function () {
    'use strict';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var root = document.documentElement;
    var finePointer = window.matchMedia('(pointer: fine)').matches;
    var forced = new URLSearchParams(location.search).get('fx') === 'force';
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

    /* =========================================================
       SPRINGS - one shared loop that sleeps when nothing is moving.
       A spring pulls `x` towards `target`; the k/c pair sets how
       heavy it feels (low k = slow, low c = bouncy).
       ========================================================= */
    var active = [];
    var running = false;
    var lastTick = 0;

    function tick(now) {
        var dt = Math.min(0.032, (now - lastTick) / 1000 || 0.016);
        lastTick = now;
        for (var i = active.length - 1; i >= 0; i--) {
            var s = active[i];
            s.v += (s.k * (s.target - s.x) - s.c * s.v) * dt;
            s.x += s.v * dt;
            if (Math.abs(s.v) < s.rest && Math.abs(s.target - s.x) < s.rest) {
                s.x = s.target; s.v = 0;
                s.apply(s.x);
                active.splice(i, 1);
                s.on = false;
            } else {
                s.apply(s.x);
            }
        }
        if (active.length) requestAnimationFrame(tick);
        else running = false;
    }

    function spring(x, k, c, apply, rest) {
        var s = {
            x: x, v: 0, target: x, k: k, c: c, apply: apply, rest: rest || 0.001, on: false,
            to: function (t) {
                s.target = t;
                if (!s.on) { s.on = true; active.push(s); }
                if (!running) { running = true; lastTick = performance.now(); requestAnimationFrame(tick); }
            }
        };
        return s;
    }

    /* =========================================================
       FLUID - the usual GPU "stable fluids" steps each frame:
       swirl (vorticity) -> make it incompressible (pressure solve)
       -> carry velocity and colour along with the flow -> draw.
       ========================================================= */
    var TIERS = [
        { sim: 64,  dye: 320, iterations: 8 },
        { sim: 96,  dye: 512, iterations: 12 },
        { sim: 128, dye: 720, iterations: 16 }
    ];

    // Logo colours, same order as the particles
    var COLOURS = [[0.13, 0.83, 0.93], [0.18, 0.83, 0.75], [0.23, 0.51, 0.96], [0.55, 0.36, 0.96], [0.78, 0.31, 0.94]];

    var VERT = '#version 300 es\nprecision highp float;in vec2 p;out vec2 vUv,vL,vR,vT,vB;uniform vec2 texel;' +
        'void main(){vUv=p*.5+.5;vL=vUv-vec2(texel.x,0.);vR=vUv+vec2(texel.x,0.);vT=vUv+vec2(0.,texel.y);vB=vUv-vec2(0.,texel.y);gl_Position=vec4(p,0.,1.);}';
    var HEAD = '#version 300 es\nprecision highp float;precision highp sampler2D;in vec2 vUv,vL,vR,vT,vB;out vec4 o;';
    var FRAGS = {
        splat: 'uniform sampler2D tex;uniform float aspect,radius;uniform vec3 color;uniform vec2 point;' +
            'void main(){vec2 d=vUv-point;d.x*=aspect;o=vec4(texture(tex,vUv).xyz+exp(-dot(d,d)/radius)*color,1.);}',
        advect: 'uniform sampler2D vel,src;uniform vec2 texel;uniform float dt,fade;' +
            'void main(){vec2 c=vUv-dt*texture(vel,vUv).xy*texel;o=texture(src,c)/(1.+fade*dt);o.a=1.;}',
        divergence: 'uniform sampler2D vel;void main(){float L=texture(vel,vL).x,R=texture(vel,vR).x,T=texture(vel,vT).y,B=texture(vel,vB).y;o=vec4(.5*(R-L+T-B),0.,0.,1.);}',
        curl: 'uniform sampler2D vel;void main(){float L=texture(vel,vL).y,R=texture(vel,vR).y,T=texture(vel,vT).x,B=texture(vel,vB).x;o=vec4(.5*(R-L-T+B),0.,0.,1.);}',
        vorticity: 'uniform sampler2D vel,curl;uniform float strength,dt;void main(){float L=texture(curl,vL).x,R=texture(curl,vR).x,T=texture(curl,vT).x,B=texture(curl,vB).x,C=texture(curl,vUv).x;' +
            'vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=strength*C;f.y*=-1.;o=vec4(clamp(texture(vel,vUv).xy+f*dt,-1000.,1000.),0.,1.);}',
        pressure: 'uniform sampler2D pres,div;void main(){float L=texture(pres,vL).x,R=texture(pres,vR).x,T=texture(pres,vT).x,B=texture(pres,vB).x;o=vec4((L+R+B+T-texture(div,vUv).x)*.25,0.,0.,1.);}',
        gradient: 'uniform sampler2D pres,vel;void main(){float L=texture(pres,vL).x,R=texture(pres,vR).x,T=texture(pres,vT).x,B=texture(pres,vB).x;o=vec4(texture(vel,vUv).xy-vec2(R-L,T-B),0.,1.);}',
        scale: 'uniform sampler2D tex;uniform float value;void main(){o=value*texture(tex,vUv);}',
        // Capped well below full strength so text stays readable over the fluid.
        // Light mode uses deeper shades at lower strength on the pale background.
        display: 'uniform sampler2D tex;uniform float light;void main(){vec3 c=texture(tex,vUv).rgb;float m=max(c.r,max(c.g,c.b));vec3 h=m>.0001?c/m:vec3(0.);' +
            'float a=(1.-exp(-m*1.7))*mix(.42,.46,light);h=mix(h,h*.62,light);o=vec4(h*a,a);}'
    };

    function createFluid() {
        var canvas = document.createElement('canvas');
        var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
        if (!gl || !gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;

        canvas.id = 'fluid-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        var particles = document.getElementById('fx-canvas');
        if (particles) particles.parentNode.insertBefore(canvas, particles);
        else document.body.insertBefore(canvas, document.body.firstChild);

        function shader(type, src) {
            var s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        }
        var vs = shader(gl.VERTEX_SHADER, VERT);
        var progs = {};
        Object.keys(FRAGS).forEach(function (name) {
            var pr = gl.createProgram();
            gl.attachShader(pr, vs);
            gl.attachShader(pr, shader(gl.FRAGMENT_SHADER, HEAD + FRAGS[name]));
            gl.bindAttribLocation(pr, 0, 'p');
            gl.linkProgram(pr);
            if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
            var u = {};
            for (var i = 0, n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS); i < n; i++) {
                var nm = gl.getActiveUniform(pr, i).name;
                u[nm] = gl.getUniformLocation(pr, nm);
            }
            progs[name] = { pr: pr, u: u };
        });

        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.disable(gl.BLEND);

        function fbo(w, h) {
            var tex = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
            var f = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, f);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            gl.viewport(0, 0, w, h);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return { tex: tex, f: f, w: w, h: h, tx: 1 / w, ty: 1 / h };
        }
        function doubleFbo(w, h) {
            var a = fbo(w, h), b = fbo(w, h);
            return { get read() { return a; }, get write() { return b; }, swap: function () { var t = a; a = b; b = t; } };
        }
        function free(t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.f); }
        function freeDouble(d) { free(d.read); free(d.write); }

        function bind(p) { gl.useProgram(p.pr); return p.u; }
        function tex(unit, loc, target) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, target.tex);
            gl.uniform1i(loc, unit);
        }
        function draw(target) {
            if (target) {
                gl.viewport(0, 0, target.w, target.h);
                gl.bindFramebuffer(gl.FRAMEBUFFER, target.f);
            } else {
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        }

        var tierIndex = forced ? 2 : (!finePointer || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 ? 0 : 1);
        var velocity, dye, pressure, divergence, curl;
        var buildW = 0;

        function size(res) {
            var w = window.innerWidth, h = window.innerHeight;
            var long = Math.round(res * Math.max(w, h) / Math.min(w, h));
            return w > h ? [long, res] : [res, long];
        }

        function build() {
            if (velocity) { freeDouble(velocity); freeDouble(dye); freeDouble(pressure); free(divergence); free(curl); }
            var t = TIERS[tierIndex];
            var s = size(t.sim), d = size(t.dye);
            canvas.width = d[0];
            canvas.height = d[1];
            velocity = doubleFbo(s[0], s[1]);
            pressure = doubleFbo(s[0], s[1]);
            dye = doubleFbo(d[0], d[1]);
            divergence = fbo(s[0], s[1]);
            curl = fbo(s[0], s[1]);
            buildW = window.innerWidth;
        }
        build();

        function splat(x, y, dx, dy, color, radius) {
            var u = bind(progs.splat);
            gl.uniform1f(u.aspect, canvas.width / canvas.height);
            gl.uniform2f(u.point, x, y);
            gl.uniform1f(u.radius, radius);
            tex(0, u.tex, velocity.read);
            gl.uniform3f(u.color, dx, dy, 0);
            draw(velocity.write);
            velocity.swap();
            tex(0, u.tex, dye.read);
            gl.uniform3f(u.color, color[0], color[1], color[2]);
            draw(dye.write);
            dye.swap();
        }

        function step(dt) {
            var t = TIERS[tierIndex], u, vr;
            gl.disable(gl.BLEND);

            u = bind(progs.curl);
            gl.uniform2f(u.texel, velocity.read.tx, velocity.read.ty);
            tex(0, u.vel, velocity.read);
            draw(curl);

            u = bind(progs.vorticity);
            gl.uniform2f(u.texel, velocity.read.tx, velocity.read.ty);
            tex(0, u.vel, velocity.read);
            tex(1, u.curl, curl);
            gl.uniform1f(u.strength, 24);
            gl.uniform1f(u.dt, dt);
            draw(velocity.write);
            velocity.swap();

            u = bind(progs.divergence);
            gl.uniform2f(u.texel, velocity.read.tx, velocity.read.ty);
            tex(0, u.vel, velocity.read);
            draw(divergence);

            u = bind(progs.scale);
            tex(0, u.tex, pressure.read);
            gl.uniform1f(u.value, 0.8);
            draw(pressure.write);
            pressure.swap();

            u = bind(progs.pressure);
            gl.uniform2f(u.texel, velocity.read.tx, velocity.read.ty);
            tex(1, u.div, divergence);
            for (var i = 0; i < t.iterations; i++) {
                tex(0, u.pres, pressure.read);
                draw(pressure.write);
                pressure.swap();
            }

            u = bind(progs.gradient);
            gl.uniform2f(u.texel, velocity.read.tx, velocity.read.ty);
            tex(0, u.pres, pressure.read);
            tex(1, u.vel, velocity.read);
            draw(velocity.write);
            velocity.swap();

            u = bind(progs.advect);
            gl.uniform2f(u.texel, velocity.read.tx, velocity.read.ty);
            gl.uniform1f(u.dt, dt);
            tex(0, u.vel, velocity.read);
            tex(1, u.src, velocity.read);
            gl.uniform1f(u.fade, 0.35);
            draw(velocity.write);
            velocity.swap();

            vr = velocity.read;
            tex(0, u.vel, vr);
            tex(1, u.src, dye.read);
            gl.uniform1f(u.fade, 0.5);
            draw(dye.write);
            dye.swap();

            u = bind(progs.display);
            gl.uniform2f(u.texel, 0, 0);
            gl.uniform1f(u.light, root.getAttribute('data-theme') === 'light' ? 1 : 0);
            tex(0, u.tex, dye.read);
            draw(null);
        }

        var api = { alive: true, tier: tierIndex, fps: 0, frames: 0 };
        // Hold each colour for about a second: changing on every splat would
        // blend them all into a dull grey-blue instead of distinct streaks
        function nextColour(strength) {
            var c = COLOURS[Math.floor(performance.now() / 1100) % COLOURS.length];
            return [c[0] * strength, c[1] * strength, c[2] * strength];
        }

        // Pixel position + pixel movement -> a stir of the fluid
        // Touch screens can fire many events per frame, so these are merged and
        // drawn at most once a frame: the movement adds up, the cost doesn't.
        var pendingStir = null;
        api.stir = function (px, py, mx, my) {
            if (!api.alive) return;
            if (pendingStir) { pendingStir.x = px; pendingStir.y = py; pendingStir.mx += mx; pendingStir.my += my; }
            else pendingStir = { x: px, y: py, mx: mx, my: my };
        };
        function applyStir() {
            if (!pendingStir) return;
            var s = pendingStir, w = window.innerWidth, h = window.innerHeight;
            pendingStir = null;
            splat(s.x / w, 1 - s.y / h, clamp(s.mx, -160, 160) / w * 5200, -clamp(s.my, -160, 160) / h * 5200, nextColour(0.22), 0.0028);
        }
        // A click: outward push in a ring, plus a bright drop of colour
        api.burst = function (px, py) {
            if (!api.alive) return;
            var x = px / window.innerWidth, y = 1 - py / window.innerHeight;
            var aspect = canvas.width / canvas.height;
            for (var i = 0; i < 5; i++) {
                var a = i / 5 * Math.PI * 2;
                var ox = Math.cos(a) * 0.022 / aspect, oy = Math.sin(a) * 0.022;
                splat(x + ox, y + oy, Math.cos(a) * 700, Math.sin(a) * 700, nextColour(0.16), 0.0012);
            }
        };

        function destroy(reason) {
            api.alive = false;
            api.offReason = reason;
            canvas.remove();
            var lose = gl.getExtension('WEBGL_lose_context');
            if (lose) lose.loseContext();
        }
        canvas.addEventListener('webglcontextlost', function () { if (api.alive) { api.alive = false; api.offReason = 'context lost'; canvas.remove(); } });

        var last = performance.now(), slowSum = 0, slowCount = 0, slowRuns = 0, skip = 40, nextAmbient = 0, seen = 0;

        function frame(now) {
            if (!api.alive) return;
            requestAnimationFrame(frame);
            if (document.hidden) { last = now; return; }
            var raw = now - last;
            // On 90-144Hz screens, simulate at about 60 steps a second: the extra steps look the same
            if (raw < 14) return;
            last = now;
            seen++;
            api.frames = seen;

            // Slow for a sustained stretch? Drop a quality level, then give up gracefully
            if (raw < 250 && !forced) {
                if (skip > 0) skip--;
                else {
                    slowSum += raw;
                    if (++slowCount >= 45) {
                        var avg = slowSum / slowCount;
                        api.fps = Math.round(1000 / avg);
                        slowSum = slowCount = 0;
                        // Two slow stretches in a row: a single hiccup (a swipe, a page
                        // load, the browser busy elsewhere) must not cost the visitor the fluid
                        slowRuns = avg > (tierIndex > 0 ? 22 : 30) ? slowRuns + 1 : 0;
                        if (slowRuns >= 2) {
                            slowRuns = 0;
                            if (tierIndex === 0) { destroy('too slow at ' + api.fps + ' fps'); return; }
                            tierIndex--;
                            api.tier = tierIndex;
                            build();
                            skip = 40;
                        }
                    }
                }
            }

            // With no one touching it the fluid keeps drifting, so phones see it too
            if (now > nextAmbient) {
                nextAmbient = now + 900 + Math.random() * 900;
                var a = Math.random() * Math.PI * 2;
                splat(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8, Math.cos(a) * 420, Math.sin(a) * 420, nextColour(0.4), 0.03);
            }
            applyStir();
            step(Math.min(raw / 1000, 1 / 40));
        }
        requestAnimationFrame(frame);

        window.addEventListener('resize', function () {
            // Ignore height-only changes: phone address bars hiding would reset the fluid
            if (api.alive && window.innerWidth !== buildW) build();
        }, { passive: true });

        return api;
    }

    /* =========================================================
       Everything the pointer touches
       ========================================================= */
    var fluid = null;
    var PRESSABLE = '.btn, .skill, .filter, .level, .pack, .powerup, .cabinet, .quest, .sound-toggle, .theme-toggle, .hud-burger, .hud-links a, .hud-mobile a, .chapter-map a, .package-option, .footer-socials a';
    var pressSprings = new WeakMap();

    function pressSpring(el) {
        var s = pressSprings.get(el);
        if (!s) {
            // `scale` is its own CSS property, so it never fights a card's transform
            s = spring(1, 520, 15, function (v) { el.style.scale = Math.abs(v - 1) < 0.0005 ? '' : v.toFixed(4); }, 0.0006);
            pressSprings.set(el, s);
        }
        return s;
    }

    function shockwave(x, y) {
        var ring = document.createElement('div');
        ring.className = 'fx-ring';
        ring.setAttribute('aria-hidden', 'true');
        ring.style.left = x + 'px';
        ring.style.top = y + 'px';
        document.body.appendChild(ring);
        ring.addEventListener('animationend', function () { ring.remove(); });
    }

    function press() {
        var held = null;
        function release() {
            if (held) { pressSpring(held).to(1); held = null; }
        }
        document.addEventListener('pointerdown', function (e) {
            if (fluid) fluid.burst(e.clientX, e.clientY);
            shockwave(e.clientX, e.clientY);
            var el = e.target.closest ? e.target.closest(PRESSABLE) : null;
            if (!el) return;
            held = el;
            // Big cards give a little, small buttons a lot
            pressSpring(el).to(el.offsetWidth > 240 && !el.classList.contains('btn') ? 0.985 : 0.93);
            if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* not allowed - fine */ } }
            // Cards aren't covered by game.js's click sounds
            if (window.CUSound && !el.matches('.btn, .skill, .hud-links a, .filter, .sound-toggle, .theme-toggle, .hud-burger')) window.CUSound.click();
        }, { passive: true });
        document.addEventListener('pointerup', release, { passive: true });
        document.addEventListener('pointercancel', release, { passive: true });
    }

    // Cards lean towards the pointer with weight, and rock back when it leaves
    function tiltCards() {
        if (!finePointer) return;
        document.querySelectorAll('[data-tilt]').forEach(function (card) {
            var rx = 0, ry = 0, lift = 0;
            function paint() {
                card.style.transform = Math.abs(rx) + Math.abs(ry) + Math.abs(lift) < 0.002 ? '' :
                    'perspective(900px) rotateY(' + ry.toFixed(3) + 'deg) rotateX(' + rx.toFixed(3) + 'deg) translateY(' + lift.toFixed(2) + 'px)';
            }
            var sx = spring(0, 170, 13, function (v) { rx = v; paint(); }, 0.01);
            var sy = spring(0, 170, 13, function (v) { ry = v; paint(); }, 0.01);
            var sl = spring(0, 170, 15, function (v) { lift = v; paint(); }, 0.01);
            card.addEventListener('pointerenter', function () {
                // Springs drive transform from here on; the CSS transition would smear them
                card.classList.add('fx-live');
                sl.to(-6);
                if (window.CUSound) window.CUSound.hover();
            });
            card.addEventListener('pointermove', function (e) {
                var r = card.getBoundingClientRect();
                sy.to(((e.clientX - r.left) / r.width - 0.5) * 9);
                sx.to(-((e.clientY - r.top) / r.height - 0.5) * 9);
            });
            card.addEventListener('pointerleave', function () { sx.to(0); sy.to(0); sl.to(0); });
        });
    }

    // Buttons pull gently towards the cursor, then spring home
    function magneticButtons() {
        if (!finePointer) return;
        document.querySelectorAll('.btn').forEach(function (btn) {
            var x = 0, y = 0;
            function paint() { btn.style.translate = Math.abs(x) + Math.abs(y) < 0.05 ? '' : x.toFixed(2) + 'px ' + y.toFixed(2) + 'px'; }
            var sx = spring(0, 210, 13, function (v) { x = v; paint(); }, 0.03);
            var sy = spring(0, 210, 13, function (v) { y = v; paint(); }, 0.03);
            btn.addEventListener('pointermove', function (e) {
                var r = btn.getBoundingClientRect();
                sx.to((e.clientX - r.left - r.width / 2) * 0.2);
                sy.to((e.clientY - r.top - r.height / 2) * 0.32);
            });
            btn.addEventListener('pointerleave', function () { sx.to(0); sy.to(0); });
        });
    }

    // Glass: a soft highlight and a bright rim that follow the light source.
    // Only panels on screen are updated, so long pages stay cheap.
    function glass() {
        var panels = document.querySelectorAll('.panel, .cabinet');
        var visible = new Set();
        var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
        }) : null;
        panels.forEach(function (p) {
            var sheen = document.createElement('span');
            sheen.className = 'glass-sheen';
            sheen.setAttribute('aria-hidden', 'true');
            p.appendChild(sheen);
            if (io) io.observe(p); else visible.add(p);
        });
        var queued = false, lx = 0, ly = 0;
        function update() {
            queued = false;
            // Read every position first, then write: mixing the two forces a layout per panel
            var rects = [];
            visible.forEach(function (p) { rects.push([p, p.getBoundingClientRect()]); });
            rects.forEach(function (item) {
                var p = item[0], r = item[1];
                var near = lx > r.left - 160 && lx < r.right + 160 && ly > r.top - 160 && ly < r.bottom + 160;
                if (near) {
                    var sheen = p.lastElementChild;
                    sheen.style.setProperty('--lx', (lx - r.left).toFixed(0) + 'px');
                    sheen.style.setProperty('--ly', (ly - r.top).toFixed(0) + 'px');
                }
                if (near !== p.classList.contains('lit')) p.classList.toggle('lit', near);
            });
        }
        function move(x, y) {
            lx = x; ly = y;
            if (!queued) { queued = true; requestAnimationFrame(update); }
        }
        window.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); }, { passive: true });
        window.addEventListener('pointerdown', function (e) { move(e.clientX, e.clientY); }, { passive: true });
    }

    // Depth: far layers move least. `translate` leaves the grid's own 3D transform alone.
    function depth() {
        var far = document.querySelector('.bg-nebula');
        var near = document.querySelector('.bg-grid');
        var title = document.querySelector('.glitch-wrap');
        var px = 0, py = 0, scrollShift = 0;
        function paint() {
            if (far) far.style.translate = (px * 18).toFixed(1) + 'px ' + (py * 18 - scrollShift).toFixed(1) + 'px';
            if (near) near.style.translate = (px * -26).toFixed(1) + 'px 0';
            if (title) title.style.translate = (px * 7).toFixed(1) + 'px ' + (py * 5).toFixed(1) + 'px';
        }
        var sx = spring(0, 26, 8, function (v) { px = v; paint(); }, 0.001);
        var sy = spring(0, 26, 8, function (v) { py = v; paint(); }, 0.001);
        window.addEventListener('pointermove', function (e) {
            if (e.pointerType === 'touch') return;
            sx.to(e.clientX / window.innerWidth * 2 - 1);
            sy.to(e.clientY / window.innerHeight * 2 - 1);
        }, { passive: true });
        // Phone tilt. iPhones require a permission prompt for this, so they
        // simply don't get it - not worth interrupting a visitor for.
        if (!finePointer && window.DeviceOrientationEvent && !DeviceOrientationEvent.requestPermission) {
            window.addEventListener('deviceorientation', function (e) {
                if (e.gamma === null) return;
                sx.to(clamp(e.gamma / 30, -1, 1));
                sy.to(clamp((e.beta - 45) / 30, -1, 1));
            }, { passive: true });
        }
        window.addEventListener('scroll', function () { scrollShift = window.scrollY * 0.04; paint(); }, { passive: true });
    }

    // Scrolling fast pushes the fluid along with the page. (A stretch of the
    // content itself was tried here, but it re-rendered all the text mid-scroll.)
    function scrollFeel() {
        var lastY = window.scrollY, lastT = performance.now(), lastPush = 0;
        window.addEventListener('scroll', function () {
            var now = performance.now();
            var dy = window.scrollY - lastY, dt = Math.max(8, now - lastT);
            lastY = window.scrollY; lastT = now;
            var speed = dy / dt; // px per ms
            if (fluid && now - lastPush > 90 && Math.abs(speed) > 0.3) {
                lastPush = now;
                fluid.stir(window.innerWidth * (0.2 + Math.random() * 0.6), window.innerHeight * 0.5, 0, clamp(-dy * 2.2, -140, 140));
            }
        }, { passive: true });
    }

    // The cursor or finger stirs the fluid
    function stirring() {
        var lx = null, ly = null;
        function move(x, y) {
            if (lx !== null && fluid) {
                var mx = x - lx, my = y - ly;
                if (Math.abs(mx) + Math.abs(my) > 1) fluid.stir(x, y, clamp(mx, -80, 80), clamp(my, -80, 80));
            }
            lx = x; ly = y;
        }
        window.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); }, { passive: true });
        // Browsers stop pointer events once a finger starts scrolling
        window.addEventListener('touchmove', function (e) { if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        window.addEventListener('touchend', function () { lx = ly = null; }, { passive: true });
    }

    /* Liquid page wipe: a wavy front of neon sweeps across, then the page colour
       follows. Replaces the straight wipe in game.js. */
    function liquidWipe() {
        var c = document.createElement('canvas');
        c.className = 'liquid-wipe';
        c.setAttribute('aria-hidden', 'true');
        var W = c.width = window.innerWidth, H = c.height = window.innerHeight;
        document.body.appendChild(c);
        var g = c.getContext('2d');
        var css = getComputedStyle(root);
        var grad = g.createLinearGradient(0, 0, W, H);
        ['--cyan', '--blue', '--violet', '--magenta'].forEach(function (name, i) { grad.addColorStop(i / 3, css.getPropertyValue(name).trim()); });
        var bg = css.getPropertyValue('--bg').trim();
        var t0 = performance.now();

        function front(p, y, t, amp) { return p * (W + amp * 2) - amp + Math.sin(y * 0.011 + t * 7) * amp * 0.55 + Math.sin(y * 0.023 - t * 11) * amp * 0.25; }
        function fill(style, p, t, amp) {
            g.fillStyle = style;
            g.beginPath();
            g.moveTo(0, 0);
            for (var y = 0; y <= H + 16; y += 16) g.lineTo(front(p, y, t, amp), y);
            g.lineTo(0, H);
            g.closePath();
            g.fill();
        }
        (function draw(now) {
            if (!c.isConnected) return;
            var t = (now - t0) / 1000;
            var p = Math.min(1, t / 0.34);
            var eased = p * p * (3 - 2 * p);
            g.clearRect(0, 0, W, H);
            fill(grad, eased, t, 120);
            fill(bg, Math.max(0, eased * 1.25 - 0.25), t + 0.4, 120);
            if (p < 1) requestAnimationFrame(draw);
        })(t0);
        // Back button can restore this page from memory with the wipe still on it
        window.addEventListener('pageshow', function () { c.remove(); }, { once: true });
    }

    // Pause the costly CSS animations while they're off screen
    function pauseOffscreen() {
        if (!('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { e.target.classList.toggle('fx-paused', !e.isIntersecting); });
        });
        document.querySelectorAll('.lava-text, .pack.featured').forEach(function (el) { io.observe(el); });
    }

    function start() {
        try { fluid = createFluid(); } catch (e) {
            console.error('[realism.js] fluid unavailable:', e);
            var bad = document.getElementById('fluid-canvas');
            if (bad) bad.remove();
        }
        CURealism.fluid = fluid;
        root.classList.add('fx-on');
        [press, tiltCards, magneticButtons, glass, depth, scrollFeel, stirring, pauseOffscreen].forEach(function (fn) {
            try { fn(); } catch (e) { console.error('[realism.js] ' + fn.name + ' failed:', e); }
        });
    }

    // game.js checks these to hand over its own versions
    var CURealism = window.CURealism = { tilt: true, magnetic: true, wipe: liquidWipe, fluid: null };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
