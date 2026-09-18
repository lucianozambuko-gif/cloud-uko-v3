/**
 * Shared scroll/background effects for the Cloud UKO site:
 *  1. Parallax drift for decorative hero shapes (.parallax-shape)
 *  2. Cursor-following glow (.mouse-glow)
 *  3. Scroll-linked hue-rotating logo background layer (.logo-bg-layer)
 *  4. Scroll-triggered typewriter reveal for headings (.type-target)
 */

/**
 * Lightweight scroll parallax for decorative background shapes.
 * Any element with class="parallax-shape" and a data-speed attribute
 * (fraction of scroll distance, e.g. 0.2) will drift as the page scrolls.
 */
document.addEventListener('DOMContentLoaded', function () {
    var shapes = document.querySelectorAll('.parallax-shape');
    if (!shapes.length) return;

    var ticking = false;

    function update() {
        var y = window.scrollY || window.pageYOffset;
        shapes.forEach(function (shape) {
            var speed = parseFloat(shape.getAttribute('data-speed')) || 0.2;
            // Set a custom property rather than transform directly, so the
            // CSS idle-float keyframe (which also animates transform) can
            // read it back in instead of the two fighting over the property.
            shape.style.setProperty('--scroll-offset', (y * speed).toFixed(1) + 'px');
        });
        ticking = false;
    }

    window.addEventListener('scroll', function () {
        if (!ticking) {
            window.requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });

    update();
});

/**
 * Soft light-blue glow that follows the cursor, sitting behind all
 * page content. No-ops on touch-only devices (no mouse to track).
 */
document.addEventListener('DOMContentLoaded', function () {
    var glow = document.querySelector('.mouse-glow');
    if (!glow || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var glowTicking = false;
    var lastX = window.innerWidth / 2;
    var lastY = window.innerHeight / 2;

    function updateGlow() {
        glow.style.setProperty('--mx', lastX + 'px');
        glow.style.setProperty('--my', lastY + 'px');
        glowTicking = false;
    }

    window.addEventListener('mousemove', function (e) {
        lastX = e.clientX;
        lastY = e.clientY;
        if (!glowTicking) {
            window.requestAnimationFrame(updateGlow);
            glowTicking = true;
        }
    }, { passive: true });
});

/**
 * Scroll-linked hue-rotating logo background. The layer itself is a
 * fixed, tiled, low-opacity pattern of the Cloud UKO icon (see CSS);
 * this just turns the hue-rotate dial as scrollY increases, so it
 * cycles continuously through the brand gradient and beyond -
 * completely independent of the foreground palette.
 */
document.addEventListener('DOMContentLoaded', function () {
    var logoLayer = document.querySelector('.logo-bg-layer');
    if (!logoLayer) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var hueTicking = false;

    function updateHue() {
        var y = window.scrollY || window.pageYOffset;
        var degrees = (y * 0.12) % 360;
        logoLayer.style.filter = 'hue-rotate(' + degrees.toFixed(1) + 'deg)';
        hueTicking = false;
    }

    window.addEventListener('scroll', function () {
        if (!hueTicking) {
            window.requestAnimationFrame(updateHue);
            hueTicking = true;
        }
    }, { passive: true });

    updateHue();
});

/**
 * Scroll-triggered typewriter reveal. Any element with class
 * "type-target" has its text content typed in character-by-character
 * the first time it scrolls into view, instead of animating on load.
 */
document.addEventListener('DOMContentLoaded', function () {
    var targets = document.querySelectorAll('.type-target');
    if (!targets.length || !('IntersectionObserver' in window)) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function typeIn(el) {
        var text = el.textContent;
        if (reduceMotion) return;

        el.textContent = '';
        el.classList.add('is-typing');

        var i = 0;
        // Faster per-character delay for longer headlines so nothing
        // takes forever to finish typing.
        var speed = Math.max(18, Math.min(45, 900 / Math.max(text.length, 1)));

        (function step() {
            el.textContent = text.slice(0, i);
            i++;
            if (i <= text.length) {
                setTimeout(step, speed);
            } else {
                el.classList.remove('is-typing');
            }
        })();
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                typeIn(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.4 });

    targets.forEach(function (el) {
        observer.observe(el);
    });
});
