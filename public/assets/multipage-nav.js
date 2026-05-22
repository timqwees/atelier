(function () {
  'use strict';

  var ROUTES = [
    { label: 'Услуги', href: '/?page=services', match: ['УСЛУГИ', 'Услуги'] },
    { label: 'Прайс', href: '/?page=price', match: ['ПРАЙС', 'Прайс', 'Цены', 'Стоимость'] },
    { label: 'Процесс', href: '/?page=process', match: ['ПРОЦЕСС', 'Процесс'] },
    { label: 'О нас', href: '/?page=about', match: ['О НАС', 'О нас', 'О компании'] },
    { label: 'Локация', href: '/?page=location', match: ['ЛОКАЦИЯ', 'Локация', 'Адрес'] },
    { label: 'Контакты', href: '/?page=contacts', match: ['КОНТАКТЫ', 'Контакты'] },
    { label: 'Ассистент', href: '/?page=assistant', match: ['КОНСУЛЬТАНТ', 'Консультант', 'АССИСТЕНТ', 'Ассистент'] }
  ];

  var PAGE_TO_LABEL = {
    services: 'Услуги',
    price: 'Прайс',
    process: 'Процесс',
    about: 'О нас',
    location: 'Локация',
    contacts: 'Контакты',
    assistant: 'Ассистент'
  };

  function normText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function sameOriginHref(href) {
    try {
      var u = new URL(href, window.location.href);
      if (u.origin !== window.location.origin) return null;
      return u.pathname + u.search + u.hash;
    } catch (_) {
      return null;
    }
  }

  function routeByText(t) {
    var nt = normText(t);
    if (!nt) return null;
    for (var i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      for (var j = 0; j < r.match.length; j++) {
        if (nt === normText(r.match[j])) return r;
      }
    }
    return null;
  }

  function scrollToAssistant() {
    var el = document.getElementById('demo-try');
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  function findNavTargetByLabel(label) {
    var wanted = normText(label);
    var candidates = Array.prototype.slice.call(document.querySelectorAll('a,button'));
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var t = normText(el.textContent);
      if (t && t === wanted) return el;
    }
    return null;
  }

  function tryScrollToSection(label) {
    if (!label) return false;
    if (normText(label) === normText('Ассистент')) return scrollToAssistant();

    var target = findNavTargetByLabel(label);
    if (target) {
      target.click();
      return true;
    }

    // Fallback: match headings
    var headings = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3'));
    var wanted = normText(label);
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      if (normText(h.textContent) === wanted) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
    }
    return false;
  }

  function bootAutoScroll() {
    var label = window.__PAGE_SECTION__ || '';
    if (!label) {
      try {
        var sp = new URLSearchParams(window.location.search || '');
        var page = (sp.get('page') || '').toLowerCase();
        label = PAGE_TO_LABEL[page] || '';
      } catch (_) {
        label = '';
      }
    }
    if (!label) return;

    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (tryScrollToSection(label) || tries > 60) clearInterval(t);
    }, 250);
  }

  function onDocClick(e) {
    var t = e.target;
    if (!t) return;

    var el = t.closest ? t.closest('a,button') : null;
    if (!el) return;

    var route = routeByText(el.textContent);
    if (!route) return;

    // If we're already on that page, let the click behave normally.
    if ((window.location.pathname + window.location.search) === route.href) return;

    // Respect explicit external links.
    if (el.tagName === 'A') {
      var resolved = sameOriginHref(el.getAttribute('href') || '');
      if (resolved && resolved !== route.href) return;
    }

    e.preventDefault();
    e.stopPropagation();
    window.location.assign(route.href);
  }

  document.addEventListener('click', onDocClick, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAutoScroll);
  } else {
    bootAutoScroll();
  }
})();

