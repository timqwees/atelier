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
  style.textContent = '.mobile-sticky-cta{position:fixed;bottom:0;left:0;right:0;z-index:9999;display:none;background:#111;border-top:1px solid #333}@media(max-width:767px){.mobile-sticky-cta{display:flex}}.mobile-sticky-cta__item{flex:1;text-align:center;padding:12px 6px;font-size:12px;font-weight:500;color:#fff;text-decoration:none;letter-spacing:.02em}.mobile-sticky-cta__item--primary{background:#333;font-weight:600}';
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
})();
