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
            shape.style.transform = 'translate3d(0, ' + (y * speed).toFixed(1) + 'px, 0)';
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
