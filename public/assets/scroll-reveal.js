/**
 * Native scroll-reveal animations (replaces Framer Motion)
 * - IntersectionObserver-based reveal on scroll
 * - Staggered children animation
 * - Hero bounce arrow
 */
(function () {
  'use strict';

  /* ===== Scroll Reveal (IntersectionObserver) ===== */
  function initScrollReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var delay = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
          setTimeout(function () {
            el.classList.add('revealed');
          }, delay);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ===== Stagger children ===== */
  function initStagger() {
    var groups = document.querySelectorAll('[data-stagger]');
    if (!groups.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var children = entry.target.querySelectorAll('[data-stagger-child]');
          children.forEach(function (child, i) {
            var delay = parseInt(child.getAttribute('data-stagger-delay') || (i * 150), 10);
            setTimeout(function () {
              child.classList.add('revealed');
            }, delay);
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    groups.forEach(function (el) { observer.observe(el); });
  }

  /* ===== Hero bounce arrow ===== */
  function initHeroBounce() {
    var arrow = document.querySelector('.hero-bounce-arrow');
    if (!arrow) return;
    arrow.style.animation = 'heroBounce 2s ease-in-out infinite';
  }

  /* ===== Init ===== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initScrollReveal();
      initStagger();
      initHeroBounce();
    });
  } else {
    initScrollReveal();
    initStagger();
    initHeroBounce();
  }
})();
