(function () {
  'use strict';

  var ITEMS = [
    { label: 'Услуги', match: ['УСЛУГИ', 'Услуги'] },
    { label: 'Прайс', match: ['ПРАЙС', 'Прайс', 'Цены', 'Стоимость'] },
    { label: 'Процесс', match: ['ПРОЦЕСС', 'Процесс'] },
    { label: 'О нас', match: ['О НАС', 'О нас', 'О компании'] },
    { label: 'Локация', match: ['ЛОКАЦИЯ', 'Локация', 'Адрес'] },
    { label: 'Контакты', match: ['КОНТАКТЫ', 'Контакты'] },
    { label: 'Ассистент', match: ['АССИСТЕНТ', 'Ассистент'], assistant: true }
  ];

  function normText(s) {
    return String(s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findNavTarget(item) {
    var candidates = Array.prototype.slice.call(document.querySelectorAll('a,button'));
    var matchSet = (item.match || []).map(normText);

    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var t = normText(el.textContent);
      if (!t) continue;
      for (var j = 0; j < matchSet.length; j++) {
        if (t === matchSet[j]) return el;
      }
    }
    return null;
  }

  function scrollToAssistant() {
    var el = document.getElementById('demo-try');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }
    return false;
  }

  function buildMenu() {
    var wrap = document.createElement('div');
    wrap.className = 'hero-inline-menu';
    wrap.setAttribute('data-testid', 'hero-inline-menu');

    ITEMS.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hero-inline-menu__btn';
      btn.textContent = item.label;
      if (item.assistant) btn.setAttribute('data-variant', 'primary');

      btn.addEventListener('click', function () {
        if (item.assistant) {
          // Open as a separate page (full reload) and then autoscroll.
          window.location.assign('/?page=assistant');
          return;
        }

        var target = findNavTarget(item);
        if (target) {
          target.click();
          return;
        }

        // Fallback: try to scroll to an element with a matching heading.
        var headings = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3'));
        var wanted = normText(item.label);
        for (var i = 0; i < headings.length; i++) {
          var h = headings[i];
          if (normText(h.textContent) === wanted) {
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
        }
      });

      wrap.appendChild(btn);
    });

    return wrap;
  }

  function findHeroTitleEl() {
    // Try to find the first visible element containing "Ателье 15/13".
    var all = Array.prototype.slice.call(document.querySelectorAll('h1,h2,div,span'));
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var txt = normText(el.textContent);
      if (txt.indexOf('ателье 15/13') !== -1) return el;
    }
    return null;
  }

  function mount() {
    if (document.querySelector('[data-testid="hero-inline-menu"]')) return;

    var titleEl = findHeroTitleEl();
    if (!titleEl) return;

    // Prefer mounting on a container that likely holds the hero title.
    var host = titleEl.parentElement || titleEl;
    var menu = buildMenu();

    // Ensure horizontal layout: title on the left, menu on the right.
    try {
      host.style.display = 'flex';
      host.style.alignItems = 'center';
      host.style.justifyContent = 'space-between';
      host.style.gap = '16px';
      host.style.flexWrap = 'wrap';
    } catch (_) {}

    host.appendChild(menu);
  }

  function boot() {
    mount();
    // The app is rendered by a JS bundle; retry a few times.
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      mount();
      if (document.querySelector('[data-testid="hero-inline-menu"]') || tries > 40) {
        clearInterval(t);
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

