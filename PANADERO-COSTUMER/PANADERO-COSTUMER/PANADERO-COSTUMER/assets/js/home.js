(function () {
    const images = [
        'assets/images/slide1.jpg',
        'assets/images/slide2.jpg',
        'assets/images/slide3.jpg'
    ];

    const alts = [
        'Freshly baked breads on display at PANADERO',
        'Cake with ice cream and a cherry from PANADERO',
        'Fruitcake topped with sugared cranberries from PANADERO'
    ];

    const AUTOPLAY_DELAY = 3000;
    let index = 0;
    let autoplayTimer = null;

    const banner = document.querySelector('.banner');
    const image = document.getElementById('banner-image');
    const previousButton = document.getElementById('previous-button');
    const nextButton = document.getElementById('next-button');

    if (!banner || !image || !previousButton || !nextButton || images.length < 2) {
        return;
    }

    function showSlide(nextIndex) {
        index = (nextIndex + images.length) % images.length;
        image.src = images[index];
        image.alt = alts[index];
    }

    function nextSlide() {
        showSlide(index + 1);
    }

    function previousSlide() {
        showSlide(index - 1);
    }

    function stopAutoplay() {
        if (autoplayTimer !== null) {
            window.clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
    }

    function startAutoplay() {
        stopAutoplay();
        if (document.hidden) {
            return;
        }
        autoplayTimer = window.setInterval(nextSlide, AUTOPLAY_DELAY);
    }

    function restartAutoplay() {
        startAutoplay();
    }

    nextButton.addEventListener('click', function () {
        nextSlide();
        restartAutoplay();
    });

    previousButton.addEventListener('click', function () {
        previousSlide();
        restartAutoplay();
    });

    banner.addEventListener('mouseenter', stopAutoplay);
    banner.addEventListener('mouseleave', startAutoplay);
    banner.addEventListener('focusin', stopAutoplay);
    banner.addEventListener('focusout', function (event) {
        if (!banner.contains(event.relatedTarget)) {
            startAutoplay();
        }
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            stopAutoplay();
        } else {
            startAutoplay();
        }
    });

    showSlide(0);
    startAutoplay();
})();
