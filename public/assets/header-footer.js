(function() {
  function load(id, url) {
    var el = document.getElementById(id);
    if (!el) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    try { xhr.send(); } catch (e) { return; }
    if (xhr.status === 200) el.innerHTML = xhr.responseText;
  }
  load('header', '/components/header.html');
  load('footer', '/components/footer.html');

  var style = document.createElement('style');
  style.textContent = '.mobile-sticky-cta{position:fixed;bottom:0;left:0;right:0;z-index:9999;display:none;background:#111;border-top:1px solid #333}@media(max-width:767px){.mobile-sticky-cta{display:flex}}.mobile-sticky-cta__item{flex:1;text-align:center;padding:12px 6px;font-size:12px;font-weight:500;color:#fff;text-decoration:none;letter-spacing:.02em}.mobile-sticky-cta__item--primary{background:#333;font-weight:600}#woot-widget-holder{bottom:15px!important}@media(max-width:767px){#woot-widget-holder{bottom:65px!important}}';
  document.head.appendChild(style);

  var cta = document.createElement('div');
  cta.className = 'mobile-sticky-cta';
  cta.innerHTML = '<a href="/pricing" class="mobile-sticky-cta__item">Прайс</a><a href="tel:+79153715041" class="mobile-sticky-cta__item">Позвонить</a><a href="https://t.me/atelie1513_bot" class="mobile-sticky-cta__item">Telegram</a><a href="/contacts" class="mobile-sticky-cta__item mobile-sticky-cta__item--primary">Записаться</a>';
  document.body.appendChild(cta);

  var btn = document.getElementById('mobile-menu-btn');
  var overlay = document.getElementById('mobile-menu-overlay');
  var close = document.getElementById('mobile-menu-close');
  var backdrop = document.getElementById('mobile-menu-backdrop');
  if (btn && overlay) {
    btn.addEventListener('click', function() {
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    });
  }
  if (close && overlay) {
    close.addEventListener('click', function() {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    });
  }
  if (backdrop && overlay) {
    backdrop.addEventListener('click', function() {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    });
  }

  function loadChatwoot() {
    if (window.chatwootSDK) return;
    window.chatwootSettings = { "position": "right", "type": "standard", "launcherTitle": "" };
    var d = document, t = 'script';
    var BASE_URL = "https://app.chatwoot.com";
    var g = d.createElement(t), s = d.getElementsByTagName(t)[0];
    g.src = BASE_URL + "/packs/js/sdk.js";
    g.async = true;
    s.parentNode.insertBefore(g, s);
    g.onload = function () {
      window.chatwootSDK.run({
        websiteToken: 'ZFDyf4j1nG7yALnV2ECbPG5H',
        baseUrl: BASE_URL
      })
    }
  }
  window.addEventListener('scroll', loadChatwoot, { once: true });
  window.addEventListener('mousemove', loadChatwoot, { once: true });
  window.addEventListener('touchstart', loadChatwoot, { once: true });
  setTimeout(loadChatwoot, 8000);
})();
