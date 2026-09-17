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
