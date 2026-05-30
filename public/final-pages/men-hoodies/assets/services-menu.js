(function () {
  var API_URL = '/api/service-menu';
  var STATIC_MENU_URL = '/assets/service-menu.json';
  var MAX_NAV_WAIT = 80;
  var menuData = null;
  var menuLoadPromise = null;
  var pendingOpen = false;
  var menuLoadFailed = false;
  var menuRoot = null;
  var selectedPath = [];
  var initialized = false;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizePath(path) {
    if (!path || path === '/') return '/';
    return String(path).replace(/\/+$/, '');
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isServicesLink(link) {
    if (!link || link.tagName !== 'A') return false;
    if (!link.closest) return false;
    if (link.closest('[aria-label="Хлебные крошки"]')) return false;
    if (link.closest('#atelier-services-menu')) return false;

    try {
      var url = new URL(link.getAttribute('href') || '', window.location.href);
      return url.origin === window.location.origin && normalizePath(url.pathname) === '/services' && !url.search && !url.hash;
    } catch (_) {
      return false;
    }
  }

  function findNavServicesLinks() {
    return Array.prototype.slice
      .call(document.querySelectorAll('a'))
      .filter(isServicesLink);
  }

  function isServicesButton(button) {
    if (!button || !button.closest || button.closest('#atelier-services-menu')) return false;

    var testId = button.getAttribute('data-testid') || '';
    if (testId === 'button-hero-services') return true;

    var text = normalizeText(button.textContent);
    return text === 'услуги' || text === 'наши услуги';
  }

  function findServicesTrigger(target) {
    if (!target || !target.closest) return null;

    var element = target.closest('a,button,[role="button"]');
    if (!element) return null;

    if (isServicesLink(element)) {
      return { element: element, type: 'link' };
    }

    if (isServicesButton(element)) {
      return { element: element, type: 'button' };
    }

    return null;
  }

  function createMenuRoot() {
    var root = document.createElement('div');
    root.id = 'atelier-services-menu';
    root.className = 'atelier-services-menu';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="atelier-services-menu__backdrop" data-services-menu-close></div>' +
      '<div class="atelier-services-menu__panel" role="dialog" aria-modal="false" aria-label="Меню услуг">' +
      '  <div class="atelier-services-menu__header">' +
      '    <div>' +
      '      <p class="atelier-services-menu__eyebrow">Услуги</p>' +
      '      <h2 class="atelier-services-menu__title">Ателье 15/13</h2>' +
      '    </div>' +
      '    <button class="atelier-services-menu__close" type="button" aria-label="Закрыть меню" data-services-menu-close>×</button>' +
      '  </div>' +
      '  <div class="atelier-services-menu__columns" data-services-menu-columns></div>' +
      '</div>';

    root.addEventListener('click', function (event) {
      var closeTarget = event.target.closest('[data-services-menu-close]');
      if (closeTarget) {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }

      event.stopPropagation();
    });

    document.body.appendChild(root);
    return root;
  }

  function isOpen() {
    return menuRoot && menuRoot.classList.contains('is-open');
  }

  function updateNavState(open) {
    findNavServicesLinks().forEach(function (link) {
      link.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function openMenu() {
    if (!menuRoot) menuRoot = document.getElementById('atelier-services-menu') || createMenuRoot();
    if (!menuData) {
      pendingOpen = true;
      loadMenuData();
      return;
    }

    menuRoot.classList.add('is-open');
    menuRoot.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('atelier-services-menu-open');
    document.body.classList.add('atelier-services-menu-open');
    updateNavState(true);
    renderMenu();
  }

  function closeMenu() {
    if (!menuRoot) return;
    menuRoot.classList.remove('is-open');
    menuRoot.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('atelier-services-menu-open');
    document.body.classList.remove('atelier-services-menu-open');
    updateNavState(false);
  }

  function toggleMenu(event, trigger) {
    event.preventDefault();

    if (trigger && trigger.type === 'button') {
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }

    if (isOpen()) {
      closeMenu();
      return;
    }

    openMenu();
  }

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('Service menu unavailable');
      return response.json();
    });
  }

  function loadMenuData() {
    if (menuData) return Promise.resolve(menuData);
    if (menuLoadPromise) return menuLoadPromise;

    menuLoadPromise = fetchJson(API_URL)
      .catch(function () {
        return fetchJson(STATIC_MENU_URL);
      })
      .then(function (data) {
        menuData = data;
        menuLoadFailed = false;
        bindNavLinks();

        if (pendingOpen) {
          pendingOpen = false;
          openMenu();
        }

        return menuData;
      })
      .catch(function () {
        menuLoadFailed = true;
        if (pendingOpen) {
          pendingOpen = false;
          window.location.href = '/services';
        }
        return null;
      });

    return menuLoadPromise;
  }

  function getColumnTitle(depth) {
    if (depth === 0) return menuData.title;
    return selectedPath[depth - 1] ? selectedPath[depth - 1].title : '';
  }

  function getColumnItems(depth) {
    if (depth === 0) return menuData.children || [];
    return selectedPath[depth - 1] ? selectedPath[depth - 1].children || [] : [];
  }

  function buildColumns() {
    var columns = [];
    var depth = 0;

    while (true) {
      var items = getColumnItems(depth);
      if (!items.length) break;

      columns.push({
        depth: depth,
        title: getColumnTitle(depth),
        items: items,
      });

      if (!selectedPath[depth]) break;
      depth += 1;
    }

    return columns;
  }

  function renderMenu() {
    if (!menuRoot || !menuData) return;

    var columnsNode = menuRoot.querySelector('[data-services-menu-columns]');
    var columns = buildColumns();

    columnsNode.innerHTML = columns.map(function (column, index) {
      var activeItem = selectedPath[column.depth];

      return (
        '<section class="atelier-services-menu__column">' +
        '  <span class="atelier-services-menu__column-kicker">' + String(index + 1).padStart(2, '0') + '</span>' +
        '  <h3 class="atelier-services-menu__column-title">' + escapeHtml(column.title) + '</h3>' +
        '  <div class="atelier-services-menu__items">' +
        column.items.map(function (item, itemIndex) {
          var hasChildren = item.children && item.children.length > 0;
          var activeClass = activeItem && activeItem.path === item.path ? ' is-active' : '';
          var leafClass = hasChildren ? '' : ' atelier-services-menu__leaf';

          if (!hasChildren) {
            return (
              '<a class="atelier-services-menu__item' + leafClass + '" href="' + escapeHtml(item.path) + '">' +
              '  <span>' + escapeHtml(item.title) + '</span>' +
              '  <span class="atelier-services-menu__arrow" aria-hidden="true">↗</span>' +
              '</a>'
            );
          }

          return (
            '<button class="atelier-services-menu__item' + activeClass + '" type="button" data-depth="' + column.depth + '" data-index="' + itemIndex + '">' +
            '  <span>' + escapeHtml(item.title) + '</span>' +
            '  <span class="atelier-services-menu__arrow" aria-hidden="true">›</span>' +
            '</button>'
          );
        }).join('') +
        '  </div>' +
        '</section>'
      );
    }).join('');

    Array.prototype.slice.call(columnsNode.querySelectorAll('[data-depth][data-index]')).forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        var depth = Number(button.getAttribute('data-depth'));
        var index = Number(button.getAttribute('data-index'));
        var item = getColumnItems(depth)[index];
        var hasChildren = item.children && item.children.length > 0;

        if (hasChildren) {
          selectedPath = selectedPath.slice(0, depth);
          selectedPath[depth] = item;
          renderMenu();
          return;
        }
        window.location.href = item.path;
      });
    });
  }

  function bindNavLinks() {
    var links = findNavServicesLinks();
    if (!links.length) return false;

    links.forEach(function (link) {
      if (link.dataset.servicesMenuBound === 'true') return;
      link.dataset.servicesMenuBound = 'true';
      link.setAttribute('aria-haspopup', 'dialog');
      link.setAttribute('aria-expanded', isOpen() ? 'true' : 'false');
    });

    return true;
  }

  function waitForNav() {
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      bindNavLinks();

      if (attempts >= MAX_NAV_WAIT) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    menuRoot = document.getElementById('atelier-services-menu') || createMenuRoot();
    bindNavLinks();
    waitForNav();

    document.addEventListener('click', function (event) {
      var trigger = findServicesTrigger(event.target);
      if (!trigger) return;
      if (menuLoadFailed && !menuData) return;

      toggleMenu(event, trigger);
    }, true);

    loadMenuData();

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });

    document.addEventListener('click', function (event) {
      if (!isOpen()) return;
      if (event.target.closest('#atelier-services-menu')) return;
      if (findServicesTrigger(event.target)) return;
      closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
