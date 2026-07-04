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
